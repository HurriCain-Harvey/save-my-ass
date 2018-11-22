const config = require('../config')
const express = require('express');
const session = require('express-session');
const http = require('http');
const port = process.env.port || 3000;
const db = require('../models');
const twilio = require('twilio');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const bodyParser = require('body-parser');
const client = new twilio(config.config.accountSid, config.config.authToken);
const app = express();

app.use(express.static(`${__dirname}/../dist/browser`));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'keyboard cat'
}))

app.post('/test', (req, res) => {
  let number = '15042615621';
  db.sequelize.query(`SELECT number from phones where number='${number}'`).then((num) => {
    // console.log(num[0][0].number);
    console.log(num[0].length);
  });
  res.end();
}); 

app.post('/sms', (req, res) => {
  const twiml = new MessagingResponse();
  let textObj = {};
  const smsCount = req.session.counter || 0;
  // OPTIONS //
  if (req.body.Body.slice(0, 7).toLowerCase() === 'options') {
    twiml.message("Try one of these commands: 'help@[address]', 'have@[address]', or 'need@[address]'");
    // they send a message back. we add to db and we send one back to them
    // HELP //
  } else if (req.body.Body.replace("'", "").slice(0, 5).toLowerCase() === 'help@') {
    if (!req.session.counter){
      req.session.counter = smsCount;
    } 
    console.log(req.session, 'REQUEST SESSION');
    textObj.number = req.body.From.slice(1);
    textObj.address = req.body.Body.slice(5);
      twiml.message('SOS marker created. You may now send a brief message with details (optional).')
      // they send a message back. we add to db and we send one back to them
      db.sequelize.query(`SELECT number from phones where number='${textObj.number}'`).then((num) => {
        if (num[0].length === 0){
          db.sequelize.query(`INSERT INTO phones (number) values ('${textObj.number}')`);
        } 
        db.sequelize.query(`INSERT INTO help_pins (id_phone, address) values ((select id from phones where number='${textObj.number}'), '${textObj.address}')`);
      });
      req.session.counter = smsCount + 1;
    // HAVE //
  } else if (req.body.Body.replace("'", "").slice(0, 5).toLowerCase() === 'have@') {
    textObj.number = req.body.From.slice(1);
    textObj.address = req.body.Body.slice(5);
    console.log(textObj);
    twiml.message('What would you like to offer? Text 1 for Food, 2 for Water, 3 for Shelter, 4 for Other');
    if (!req.session.counter) {
      req.session.counter = smsCount;
    }
    console.log(req.session, 'REQUEST SESSION');
    db.sequelize.query(`SELECT number from phones where number='${textObj.number}'`).then((num) => {
      if (num[0].length === 0) {
        db.sequelize.query(`INSERT INTO phones (number) values ('${textObj.number}')`);
      }
      db.sequelize.query(`INSERT INTO have_pins (id_phone, address) values ((select id from phones where number='${textObj.number}'), '${textObj.address}')`);
    });
    req.session.counter = smsCount + 1;
    
    
    
    
    
    // we need to let them know that they need to remove things when they run OUT
    // NEED //
  } else if (req.body.Body.replace("'", "").slice(0, 5).toLowerCase() === 'need@') {
    textObj.number = req.body.From.slice(1);
    textObj.address = req.body.Body.slice(5);
    console.log(textObj);
    twiml.message('What do you need? Text 1 for Food, 2 for Water, 3 for Shelter');
    // send back a message with 3 closest places who have that
    // OUT //
  } else if (req.body.Body.replace("'", "").slice(0, 4).toLowerCase() === 'out@') {
    textObj.number = req.body.From.slice(1);
    textObj.address = req.body.Body.slice(5);
    console.log(textObj);
    twiml.message('What are you out of? Text 1 for Food, 2 for Water, 3 for Shelter, 4 for Other');
    // they let us know what they're out of and we remove from db
  } else {
    if (req.session.counter > 0) {
      textObj.message = req.body.Body;
      textObj.number = req.body.From.slice(1);
      console.log(textObj, 'SECOND MESSAGE oBJECT?????????')
      db.sequelize.query(`UPDATE help_pins SET message = '${req.body.Body}' from phones where phones.number = '${textObj.number}' and help_pins.id_phone = (select id from phones where number='${textObj.number}')`);
      twiml.message("Message added to marker.");
      req.session.counter = smsCount + 1;
    } else {
      twiml.message("Error: We don\'t know what you mean. Please enter 'help@[address]', 'have@[address]', or 'need@[address]'")
    }
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
})

http.createServer(app).listen(port, () => console.log(`Express server listening on port ${port}!`));