/*jshint node:true */
'use strict';
var bunyan = require('bunyan');
var moment = require('moment-timezone');

var Logger = function() {
  this._ringbuffer = new bunyan.RingBuffer({ limit: 100 });
  this._log = bunyan.createLogger({
      name: 'myLogger',
      streams: [
          {
              level: 'trace',  // this is a minimum error level
              type: 'raw',     // this provides access to raw objects
              stream: this._ringbuffer
          }
      ]
  });
};

Logger.prototype = {
  info: function info( msg ) { this._log.info( msg ); },
  error: function error( msg ) { this._log.error( msg ); },
  getLogs: function getLogs() {
    var logs = [];

    for ( var i = this._ringbuffer.records.length - 1; i >= 0; i-- ) {
      logs.push( this._ringbuffer.records[i] );
    }

    return logs.map( prepareLogForDisplay );
  }
};

function prepareLogForDisplay( log ) {
  var timestamp = moment( log.time );
  var timestampStr = timestamp.tz('America/Chicago').format('MMMM Do YYYY, h:mm:ss a');
  timestampStr += ' (' + timestamp.fromNow() + ')';
  return {
    msg: log.msg,
    time: timestampStr
  };
}

module.exports = function initialize(){
  return new Logger();
};