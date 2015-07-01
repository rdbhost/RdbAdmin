

var domain = '{{HOSTNAME}}';
var demo_r_role = '{{SUPER_ROLE}}'.replace('s','r');
var demo_r_pass = '-';

/*
*
* tests for the jQuery addin
*
*/

var testIFrame = '<iframe id="testFrame" width="1000px" height="1000px"> </iframe>';

module('rdbadmin', {
  setup: function () {
      $('body').append(testIFrame);
    },
  teardown: function () {
      $('#testFrame').remove();
    }
});


// verify setup
asyncTest('verify setup', 2, function() {
  $('#testFrame').attr('src','/rdbadmin');
  $('#testFrame').load( function () {
    return; // todo remove
    setTimeout(function () {
      var $tF = $('#testFrame').contents();
      var $tFb = $tF.find('body');
      ok($tFb.length, 'no body found');
      var $tFsl = $tF.find('#schema-list');
      ok($tFsl.length, 'schema list is there');
      start();
    }, 1000)
  })
});


// verify setup
asyncTest('verify basic', 2, function() {
  $('#testFrame').attr('src','/rdbadmin');
  $('#testFrame').load( function () {
    return; // todo remove
    setTimeout( function () {
      var $tF = $('#testFrame').contents();
      ok($tF.find('#schema-list').length, 'schema list is there');
      var $tL = $tF.find('#table-list');
      var $tLV = $tF.find('#table-list:visible');
      ok(!$tLV.length, 'table list is not visible'+$tLV.length);
      start();
    }, 1000)
  })
});








