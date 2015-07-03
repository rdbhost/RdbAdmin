(function ($) {

    /*  $(document).delegate('form, btn', 'submit', function () {

     //alert('submit!');
     var tgt = $(this).attr('target');
     if ( ! tgt ) {
     var lbl = $(this).attr('id') || this.toString();
     alert('no target in form '+lbl);
     }
     else {

     var tgtF = $('#'+tgt);
     if ( ! tgtF.length )
     alert('target frame not found for form');
     }
     return true;
     });*/

    _.mixin(_.string.exports());

    if (location.protocol === 'http:') {

        try {
            location.protocol = 'https:';
        }
        catch (e) {
            location.protocol = 'https';
        }
    }

    var prefix = location.hostname.lastIndexOf('rdbhost.com') >= location.hostname.length - 11
            ? location.hostname.split('.')[0] : 'www',
        acct = location.search;

    if (/^\??\d+$/.test(acct)) {

        if (acct.substr(0, 1) === '?') {

            acct = acct.substring(1);
            acct = 's' + ('0000000000'.substr(0, 10 - acct.length)) + acct;
        }
    }
    else {
        acct = '';
    }


    var rdbSQL = new SQLEngine(acct, null, prefix + '.rdbhost.com'),
        dbMgr = new DatabaseManager(rdbSQL),
        rdbAdmin = new RDBHostAdminManager(dbMgr),
        dataDisplayer = new DataDisplayer(rdbAdmin),
        sqlPanel = new SqlPanel(rdbAdmin, rdbSQL, dataDisplayer),
        receditPanel = new RecEditPanel(rdbAdmin, dbMgr, sqlPanel),
        loginPanel = new RDBHostLoginManager(rdbAdmin, dbMgr),
        schemaPanel = new SchemaPanel(rdbAdmin, dbMgr),
        createSchemaPanel = new CreateSchemaPanel(rdbAdmin, dbMgr, receditPanel),
        createViewPanel = new CreateViewPanel(rdbAdmin, dbMgr, sqlPanel, receditPanel),
        selectPanel = new SelectPanel(rdbAdmin, dbMgr, sqlPanel, dataDisplayer),
        tablePanel = new TablePanel(rdbAdmin, dbMgr),
        alterTablePanel = new AlterTablePanel(rdbAdmin, dbMgr, sqlPanel, receditPanel),
        alterConstraintsPanel = new AlterConstraintsPanel(rdbAdmin, dbMgr, sqlPanel, receditPanel),
        alterIndexPanel = new AlterIndexPanel(rdbAdmin, dbMgr, sqlPanel, receditPanel),
        functionPanel = new FunctionPanel(rdbAdmin, dbMgr, sqlPanel, receditPanel),
        triggerPanel = new TriggerPanel(rdbAdmin, sqlPanel, dbMgr, receditPanel),
        permissionsPanel = new PermissionsPanel(rdbAdmin, dbMgr);

    function login_page() {

        if (rdbAdmin.isLoggedIn()) {

            app.setLocation('#/');
        }
        else {

            rdbAdmin.showPanel('login-panel');
            loginPanel.show();
        }
    }

    function home_page() {

        if (!rdbAdmin.isLoggedIn()) {

            app.setLocation('#/login');
        }
        else {

            rdbAdmin.breadCrumbs(['rdbadmin', ['']]);
            rdbAdmin.showPanel('schema-panel');
            rdbAdmin.updateSidePanel('tvsf');
            schemaPanel.show();
        }
    }

    function sqlcommand_page() {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'sql-command', ['sqlcommand']
        ]);

        rdbAdmin.showPanel(sqlPanel.panelId);
        sqlPanel.showQuery();
    }

    function createschema_page() {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'create-schema', ['createschema']
        ]);

        rdbAdmin.showPanel(createSchemaPanel.panelId);
        createSchemaPanel.show('create', null);
    }

    function createtable_page() {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'create-table', ['createtable']
        ]);

        rdbAdmin.showPanel(alterTablePanel.panelId);
        alterTablePanel.show('create', null);
    }

    function createview_page() {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'create-view', ['createview']
        ]);

        rdbAdmin.showPanel(createViewPanel.panelId);
        createViewPanel.show('create', null);
    }

    function createfunction_page() {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'create-function', ['createfunction']
        ]);

        rdbAdmin.showPanel(functionPanel.panelId);
        functionPanel.show('create', null);
    }


    function altertrigger_page(context) {

        var tableName = context.params['tablename'],
            triggerName = context.params['triggername'];

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'table', ['table', tableName],
            'alter-trigger', ['altertrigger']
        ]);

        rdbAdmin.showPanel(triggerPanel.panelId);
        triggerPanel.show(tableName, triggerName);
    }

    function altertable_page(context) {

        var tableName = context.params['tablename'];

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'table', ['table', tableName],
            'alter-table', ['altertable']
        ]);

        rdbAdmin.showPanel(alterTablePanel.panelId);
        alterTablePanel.show('alter', decodeURI(tableName));
    }

    function alterconstraint_page(context) {

        var tableName = context.params['tablename'];

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'table', ['table', tableName],
            'alter-constraints', ['alterconstraint']
        ]);

        rdbAdmin.showPanel("alter-constraint-panel");
        alterConstraintsPanel.show('alter', decodeURI(tableName));
    }

    function alterindex_page(context) {

        var tableName = context.params['tablename'];

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'table', ['table', tableName],
            'alter-indexes', ['alterindex']
        ]);

        rdbAdmin.showPanel("alter-index-panel");
        alterIndexPanel.show('alter', decodeURIComponent(tableName));
    }

    function alterview_page(context) {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'alter-view', ['alterview']
        ]);

        var viewName = context.params['name'];
        rdbAdmin.showPanel(createViewPanel.panelId);
        createViewPanel.show('edit', decodeURIComponent(viewName));
    }

    function alterschema_page(context) {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'alter-schema', ['alterschema']
        ]);

        var schemaName = context.params['name'];
        rdbAdmin.showPanel(createSchemaPanel.panelId);
        createSchemaPanel.show('edit', decodeURIComponent(schemaName));
    }

    function alterfunction_page(context) {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'alter-function', ['alterfunction']
        ]);

        var functionName = context.params['name'];
        rdbAdmin.showPanel(functionPanel.panelId);
        functionPanel.show('edit', decodeURIComponent(functionName));
    }

    function browser_page(context) {

        var tableName = context.params['name'];
        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'browser', ['browser']
        ]);

        rdbAdmin.showPanel('select-panel');
        selectPanel.show(decodeURIComponent(tableName));
    }

    function insertrecord_page(context) {

        var tableName = context.params['tablename'];

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'browser', ['browser', tableName],
            'insert-record', ['browser', 'insert']
        ]);

        rdbAdmin.showPanel(receditPanel.panelId);
        receditPanel.show_new(decodeURIComponent(tableName));
    }

    function editrecord_page(context) {

        var tableName = context.params['tablename'];
        var keyVals = context.params['keyvals'];

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'browser', ['browser', tableName],
            'edit-record', ['browser', 'editrec']
        ]);

        rdbAdmin.showPanel(receditPanel.panelId);
        receditPanel.show_row(decodeURIComponent(tableName),
            decodeURIComponent(keyVals));
    }

    function viewbrowser_page(context) {

        var viewName = context.params['name'];

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'vbrowser', ['vbrowser']
        ]);

        rdbAdmin.showPanel('select-panel');
        selectPanel.show(decodeURIComponent(viewName), 'isView');
    }

    function table_page(context) {

        var tableName = context.params['name'];

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'table', ['table', tableName]
        ]);

        rdbAdmin.showPanel(tablePanel.panelId);
        tablePanel.show(decodeURIComponent(tableName));
    }

    function permissions_page(context) {

        rdbAdmin.breadCrumbs([
            'rdbadmin', [''],
            'permissions', ['permissions']
        ]);

        rdbAdmin.showPanel(permissionsPanel.panelId);
        permissionsPanel.show();
    }

    var side_panel_inited = false;

    function before_route() {

        rdbAdmin.resetMessages();
        rdbAdmin.hideAjaxIndicator();

        if (!side_panel_inited) {
            rdbAdmin.updateSidePanel('vtsf');
            side_panel_inited = true;
        }
    }

    /*
     sammy application handles all the hash-tagging, forward and back
     button management, and basic routing.
     */
    var app = $.sammy(function () {

        // run before each route, except /login
        this.before({except: {path: '#/login'}}, before_route);

        // define all the routes
        this.get('#/', home_page);

        this.get('#/login', login_page);

        this.get('#/sqlcommand', sqlcommand_page);

        this.get('#/permissions', permissions_page);

        this.get('#/altertable/:tablename', altertable_page);

        this.get('#/createschema', createschema_page);

        this.get('#/createview', createview_page);

        this.get('#/createtable', createtable_page);

        this.get('#/createfunction', createfunction_page);

        this.get('#/browser/:name', browser_page);

        this.get('#/vbrowser/:name', viewbrowser_page);

        this.get('#/view/:name', alterview_page);

        this.get('#/table/:name', table_page);

        this.get('#/schema/:name', alterschema_page);

        this.get('#/function/:name', alterfunction_page);

        this.get('#/alterconstraint/:tablename', alterconstraint_page);

        this.get('#/alterindex/:tablename', alterindex_page);

        this.get('#/altertrigger/:tablename', altertrigger_page);

        this.get('#/browser/insert/:tablename', insertrecord_page);

        this.get('#/browser/editrec/:tablename/:keyvals', editrecord_page);

    });

    $(document).ready(function () {

        rdbAdmin.init(app);
        dataDisplayer.init_handlers(app);
        sqlPanel.init_handlers(receditPanel);
        permissionsPanel.init_handlers(app);
        loginPanel.init_handlers(app, loggedIn, notLoggedIn);
        schemaPanel.init_handlers();
        createSchemaPanel.init_handlers(app);
        createViewPanel.init_handlers(app);
        selectPanel.init_handlers(app);
        tablePanel.init_handlers(app);
        alterTablePanel.init_handlers(app);
        alterConstraintsPanel.init_handlers(app);
        alterIndexPanel.init_handlers(app);
        receditPanel.init_handlers();
        functionPanel.init_handlers(app);
        triggerPanel.init_handlers(app);

        function loggedIn(role) {
            // initialize sammy here to avoid premature processing of current #tag
            $('#currentUserName').html(role);
            if (app.isRunning())
                app.setLocation('#/');
            else
                app.run('#/');
        }

        function notLoggedIn(err) {
            // initialize sammy here to avoid premature processing of current #tag
            if (err) {
                $('#loginerror').text(err[1]);
                $('#loginerror').show();
            }
            $('#currentUserName').html('anonymous');
            if (app.isRunning())
                app.setLocation('#/login');
            else
                app.run('#/login');
        }

        loginPanel.autoLogin(acct, loggedIn, notLoggedIn);
    });

})(jQuery);
