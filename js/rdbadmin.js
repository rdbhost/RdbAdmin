var adminpath = '/rdbadmin';

/*
 * jQuery Cookies Plugin
 */
jQuery.cookie = function(name, value, options) {
  if (typeof value !== 'undefined') { // name and value given, set cookie
    options = options || {};
    if (value === null) {
      value = '';
      options = $.extend({}, options); // clone object since it's unexpected behavior if the expired property were changed
      options.expires = -1;
    }
    var expires = '';
    if (options.expires && (typeof options.expires === 'number' || options.expires.toUTCString)) {
      var date;
      if (typeof options.expires === 'number') {
        date = new Date();
        date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
      }
      else {
        date = options.expires;
      }
      expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
    }
    // NOTE Needed to parenthesize options.path and options.domain
    // in the following expressions, otherwise they evaluate to undefined
    // in the packed version for some reason...
    var path = options.path ? '; path=' + (options.path) : '',
        domain = options.domain ? '; domain=' + (options.domain) : '',
        secure = options.secure ? '; secure' : '';
    document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
  }
  else { // only name given, get cookie
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i += 1) {
        var cookie = jQuery.trim(cookies[i]);
        // Does this cookie string begin with the name we want?
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
};

/*
 a callback aggregator, waits until 'finished' has been called for all tag values in taglist
 and then calls callback.
 */
function OnAllFinish(tagList, callBack) {

  this.finished = function(tag) {
    var pos = $.inArray(tag,tagList);
    if (pos >= 0) {
      tagList.splice(pos, 1);
    }
    if (tagList.length === 0) {
      callBack();
    }
  }
}


/*
 general purpose interface class, providing methods used by most other classes
 */
function RDBHostAdminManager(databaseManager) {

  var sqlEngine = databaseManager.sqlEngine,
      app = undefined,
      that = this;

  // function to handle error result of query submit
  function errback(err) {
    that.rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
  }

  this.init = function(ap) {
    app = ap;
  };

  this.isLoggedIn = function() {
    return sqlEngine.hasUserAuthentication();
  };

  this.breadCrumbs = function(crumbs) {
    // parms is list of lists
    // [  name0, [ path00, path01,... ] ,
    //    name1, [ path10, path11...  ]  ... ]
    var links = [];
    while (crumbs.length) {
      var label = crumbs.shift(),
          pathParts = crumbs.shift(),
          parts = ['#'], url, item;
      while ( pathParts.length ) {
        parts.push(pathParts.shift()); // encodeURIComponent(pathParts.shift()));
      }
      url = parts.join('/');
      if (crumbs.length) {
        item = '<a href="~url">~lbl</a>'.replace('~url',url).replace('~lbl',label);
      }
      else {
        item = '<span class="fauxurl">~lbl</span>'.replace('~lbl',label);
      }
      links.push(item);
    }
    $('#panel-navbar').html(links.join(' &nbsp; '));
  };

  this.showPanel = function(panelID, noStyle) {
    if (noStyle) {
      $('#withoutstyle').show();
      $('#pagewrap').hide();
    }
    else {
      $('#withoutstyle').hide();
      $('#pagewrap').show();
    }
    $(".content-panel").hide();
    $(".tablehide").hide();
    $("#" + panelID).show();
  };

  this.loadNewPage = function(gowhere) {
    setTimeout(function() {
      app.setLocation(gowhere);
    },50)
  };

  this.setHeading = function(headingText) {
    $('#panel-heading').text(headingText);
  };

  this.updateTableList = function(data) {
    var tableListId = 'table-list',
        tblRow0 = $('#table-list-row'),
        tblRow = tblRow0.clone(),
        uTL = this;
    tblRow.removeAttr('id').show();

    function drawTableList(tableNames) {
      var i, tblName, tRow, tRowTxt;
      uTL.clearTableList();
      $('#' + tableListId).append(tblRow0.hide());
      if (tableNames.length === 0) {
        $('#' + tableListId).append('<li><i>no tables</i></li>');
      }
      var public_tables = [],
          schema_tables = [];
      for (i in tableNames) {
        tblName = tableNames[i];
        if (tblName[1] === 'public') {
          public_tables.push(tblName[0]);
        }
        else {
          schema_tables.push(tblName[1] + '.' + tblName[0]);
        }
      }
      public_tables.sort();
      for (i in public_tables) {
        tblName = encodeURIComponent(public_tables[i]);
        tRow = tblRow.clone();
        tRowTxt = tRow.html();
        tRowTxt = tRowTxt.replace(/-tblName-/g, tblName);
        tRow.html(tRowTxt).show();
        $('#' + tableListId).append(tRow);
      }
      schema_tables.sort();
      for (i in schema_tables) {
        tblName = encodeURIComponent(schema_tables[i]);
        tRow = tblRow.clone();
        tRowTxt = tRow.html();
        tRowTxt = tRowTxt.replace(/-tblName-/g, tblName);
        tRow.html(tRowTxt).show();
        $('#' + tableListId).append(tRow);
      }
    }
    if ( data !== undefined ) {
      drawTableList(data);
    }
    else {
      databaseManager.getTableNames(drawTableList, errback);
    }
  };

  this.updateViewList = function(data) {
    var viewListID = 'view-list',
        vwRow0 = $('#view-list-row'),
        vwRow = vwRow0.clone(),
        uTL = this;
    vwRow.removeAttr('id').show();

    function drawViewList(viewNames) {
      var i, vwName, vRow, vRowTxt;
      uTL.clearViewList();
      $('#' + viewListID).append(vwRow0.hide());
      if (viewNames.length === 0) {
        $('#' + viewListID).append('<li><i>no views</i></li>');
      }
      var public_views = [],
          schema_views = [];
      for (i in viewNames) {
        if (viewNames[i][1] === 'public') {
          public_views.push(viewNames[i][0]);
        }
        else {
          schema_views.push(viewNames[i][1] + '.' + viewNames[i][0]);
        }
      }
      public_views.sort();
      for (i in public_views) {
        vwName = encodeURIComponent(public_views[i]);
        vRow = vwRow.clone();
        vRowTxt = vRow.html();
        vRowTxt = vRowTxt.replace(/-vwName-/g, vwName);
        vRow.html(vRowTxt).show();
        $('#' + viewListID).append(vRow);
      }
      schema_views.sort();
      for (i in schema_views) {
        vwName = encodeURIComponent(schema_views[i]);
        vRow = vwRow.clone();
        vRowTxt = vRow.html();
        vRowTxt = vRowTxt.replace(/-vwName-/g, vwName);
        vRow.html(vRowTxt).show();
        $('#' + viewListID).append(vRow);
      }
    }
    if ( data !== undefined ){
      drawViewList(data);
    }
    else {
      databaseManager.getViewNames(drawViewList, errback);
    }
  };

  this.updateSchemaList = function(data) {
    var schemaListID = 'schema-list',
        scRow0 = $('#schema-list-row'),
        scRowTpl = scRow0.clone(),
        that = this;
    scRowTpl.show();

    function drawSchemaList(schemaNames) {
      that.clearSchemaList();
      $('#' + schemaListID).append(scRowTpl.hide());
      if (schemaNames.length === 0) {
        $('#' + schemaListID).append('<li><i>no schemata</i></li>');
      }
      schemaNames.sort();
      for (var i in schemaNames) {
        var scName = encodeURIComponent(schemaNames[i]),
            scRow = scRowTpl.clone().removeAttr('id'),
            scRowTxt = scRow.html();
        scRowTxt = scRowTxt.replace(/-schName-/g, scName);
        scRow.html(scRowTxt).show();
        $('#' + schemaListID).append(scRow);
      }
    }
    if (data !== undefined) {
      drawSchemaList(data);
    }
    else {
      databaseManager.getSchemaNames(drawSchemaList, errback);
    }
  };

  this.updateFunctionList = function(data) {

    var functionListId = 'function-list',
        funcrow0 = $('#' + functionListId + '-row'),
        funcrow = funcrow0.clone();
    funcrow.removeAttr('id').show();

    function drawFunctionList(functionNames) {

        var i;
      that.clearFunctionList();
      var $fListId = $('#' + functionListId);
      $fListId.append(funcrow0.hide());

      if (functionNames.length === 0) {
        $fListId.append('<li><i>no functions</i></li>');
      }
      functionNames.sort();

      for (i in functionNames) {

        var fName = functionNames[i][0],
            funcRow = funcrow.clone().removeAttr('id'),
            funcRowTxt = funcRow.html();
        funcRowTxt = funcRowTxt.replace(/-funcName-/g, fName);
        funcRow.html(funcRowTxt).show();
        $fListId.append(funcRow);
      }
    }

    if ( data !== undefined ) {
      drawFunctionList(data);
    }
    else {
      databaseManager.getFunctionNames(drawFunctionList, errback);
    }
  };

  this.updateSidePanel = function(which) {

    // tvsf
    function displayAll(json) {
      var rs_list = json.result_sets;
      if ( which.indexOf('t')>-1 ) {
        that.updateTableList(rs_list.shift().records.rows);
      }
      if ( which.indexOf('v')>-1 ) {
        that.updateViewList(rs_list.shift().records.rows);
      }
      if ( which.indexOf('s')>-1 ) {
        that.updateSchemaList(rs_list.shift().records.rows);
      }
      if ( which.indexOf('f')>-1 ) {
        that.updateFunctionList(rs_list.shift().records.rows);
      }
    }

    databaseManager.getSidePanelNames(which, displayAll, errback);
  };

  this.clearViewList = function() {
    $('#view-list').empty();
  };

  this.clearTableList = function() {
    $("#table-list").empty();
  };

  this.clearSchemaList = function() {
    $("#schema-list").empty();
  };

  this.clearFunctionList = function() {
    $("#function-list").empty();
  };

  this.showAjaxIndicator = function() {
    $('#ajax-indicator').show();
  };

  this.hideAjaxIndicator = function() {
    $('#ajax-indicator').hide();
  };

  this.onStartQueryExecution = function() {
    this.showAjaxIndicator();
    // start time
    this.time_start = parseInt(new Date().getTime().toString(), 10);
  };

  this.onStopQueryExecution = function() {
    this.time_end = parseInt(new Date().getTime().toString(), 10);
    this.showExecutionTime();
    this.hideAjaxIndicator();
  };

  this.showExecutionTime = function() {
    var t = parseFloat((this.time_end - this.time_start) / 1000);
    $('#status_message').empty().append('Last query execution time: ' + t + ' seconds');
  };

  this.showWorkingMessage = function(message) {
    var $wm = $('#working_message');
    if (message) {
      $wm.empty().append(message).show();
    }
    else {
      $wm.empty().hide();
    }
  };

  this.showErrorMessage = function(message) {
    var $em = $('#errorMessage');
    if (message) {
      $em.empty().append(message).show();
    }
    else {
      $em.empty().hide();
    }
  };

  this.resetMessages = function() {
    $('#errorMessage').empty().hide();
    $('#working_message').empty().hide();
  };

}

/*
 shows login page
 */
function RDBHostLoginManager(rdbAdmin, databaseManager) {

  this.panelId = 'login-panel';
  var formId = 'login-panel-form',
      that = this,
      app;

  function liFail(err) {
    that.show(err[0] + ' ' + err[1]);
  }

  this.init_handlers = function(_app, onLogin, onFail) {

    app = _app;
    that.installFormHandler(formId, onLogin, onFail);
  };

  this.autoLogin = function(acct, onSuccess, onFail) {

    $('#login-panel').find('input[name="acct"]').val(acct);

    var rdbcookie = jQuery.cookie('rdbadmin');

    if ( rdbcookie && ~rdbcookie.indexOf('!') ) {

      var ckParts = rdbcookie.split('!'),
          role = ckParts[0],
          authcode = _.rest(ckParts).join('');
      if ( role && authcode ) {
        databaseManager.sqlEngine.setUserAuthentication(role, authcode);
        onSuccess(role);
      }
      else {
        onFail();
      }
    }
    else {
      onFail();
    }
  };

  this.login = function() {

    var fId = aFormId || formId,
        $form = $('#' + fId);
    $form.find('#email').val(email ? email : '');
    $form.find('#password').val(pass ? pass : '');
    $form.submit();
  };

  this.show = function(errmsg) {

    rdbAdmin.setHeading("Login to Rdbhost");
    rdbAdmin.showPanel(this.panelId);
    $('#' + this.panelId + ' #loginerror').html(errmsg);
    rdbAdmin.onStopQueryExecution();
  };

  this.installFormHandler = function(formId, onlogin, onFail) {

    function OnLogin(json) {

        var rows = json.records.rows,
            role, authcode;
        _.each(rows, function(r) {

            if (r.role.substring(0,1) === 's') {

              databaseManager.sqlEngine.setUserAuthentication(r.role, r.authcode);
              role = r.role;
              authcode = r.authcode;
            }
        });

        jQuery.cookie('rdbadmin', role+'!'+ authcode);
        onlogin(role);
    }

    $('#'+formId).submit( function(ev) {

      ev.stopImmediatePropagation();
      var $frm = $('#'+formId),
          email = $frm.find('[name="email"]').val(),
          password = $frm.find('[name="password"]').val(),
          acct = $frm.find('[name="acct"]').val();

      var t = /([spra]?)(\d+)/.exec(acct),
          uName, prefix, acctNum;

      if ( t ) {

        prefix = t[1] || 's';
        acctNum = t[2];
        uName = prefix + ('0000000000'.substr(0,10-acctNum.length)) + acctNum;

        databaseManager.sqlEngine.setUserAuthentication(uName);

        databaseManager.sqlEngine.loginAjax({

          'acct' : acctNum,
          'email' : email,
          'password' : password,
          'callback' : OnLogin,
          'errback' : onFail
        });
      }
      else {
        onFail('login', 'bad acct number');
      }

      return false;
    });
  };
}

//
