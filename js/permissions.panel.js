/*
 This module provides code to display table (and assoc index) structures

 */

var ALL_ROLES = [ 'super', 'auth', 'preauth', 'read' ],

    ALL_PRIVS = {
        'schema' : ['create', 'usage', 'temp'],
        'table' : ['select', 'insert', 'update','delete'],
        'view' :   ['select'],
        'sequence' : ['usage','select','update'],
        'function' :  ['execute']                       },

    NAMED_SCHEMATA = [ 'public', 'auth', 'lookup', 'monitor' ],

    PRIV_CODES = {
        'r' : 'select',
        'w' : 'update',
        'a' : 'insert',
        'd' : 'delete',
        'D' : 'truncate',
        'x' : 'references',
        't' : 'trigger',
        'X' : 'execute',
        'U' : 'usage',
        'C' : 'create',
        'c' : 'connect',
        'T' : 'temporary',
        '*' : 'grnt'            };

function Statuser() {

    this.statusOf = function(schema, name, typ, role, priv) {

        var t = statusTree[role];
        if ( !t ) return '';

        t = t[schema];
        if ( !t ) return '';

        t = t[typ];
        if ( !t ) return '';

        t = t[priv];
        if ( !t ) return '';

        t = t[name] || t['*'];
        if ( !t ) return '';

        return t;
    };

    var MANDATORY = [

            [ 'lookup', 'schema','','usage','*' ],
            [ 'monitor','schema','','usage','*' ],
            [ 'auth',   'schema','','usage','*' ],
            [ 'public', 'schema','','usage','*' ],

            [ 'monitor','function','*','execute','*'],
            [ 'auth',   'function','*','execute','*'],
            [ 'lookup', 'function', '_lookup_page(character varying,character varying[])', 'execute', '*' ]
        ],

        RECOMMENDED = [
            /*  schema  type  resource|*  priv|priv[]|*  role|*  */
            [ '*', 'schema', '', 'usage', '*' ],

            [ 'lookup', 'schema', '', 'usage', '*' ],
            [ 'lookup', 'table', 'preauth_queries', 'select', ['preauth', 'auth'] ],
            [ 'lookup', 'table', 'pseudofiles', 'select', ['read', 'preauth', 'auth'] ],

            [ 'auth', 'table', 'openid_accounts', 'select', ['auth', 'preauth']]
        ],

        DISCOURAGED = [
            /*  schema  type  resource|*  priv|priv[]|*  role|*  */
            [ '*', 'schema', '*', 'create', ['read','preauth','auth'] ],

            [ 'monitor', 'table', 'sqllog', '*', ['preauth','auth','read'] ],

            [ 'lookup', 'table', '*', ['insert','update','delete'], ['preauth','auth'] ],

            [ 'auth', 'table', 'openid_accounts', ['insert','update','delete'], '*']
            /* [ 'lookup', 'table', 'queries', '*', 'read'], */
        ],

        FORBIDDEN = [

            [ 'auth', 'table', 'openid_accounts', '*', 'read' ],

            [ 'lookup', 'table', 'pseudofiles', ['insert','update','delete'], 'read'],
            [ 'lookup', 'table', 'preauth_queries', '*', 'read']
        ],

        // object to gather
        statusTree = {};

    /*
      statusTree = { 'roleX' :
                        {  'schemaX' :
                            {  'schema|table|view..' :
                                {  'select|update|insert...'  :
                                    {   'rsrcName' : 'must|should|should-not|must-not'
     */

    function eachRequirement(schema, typ, rsrcName, priv, role, stat) {

        if ( role === 'super' )
            return;

        if ( role === '*' )
            role = ALL_ROLES;

        if ( typ == 'schema' )
            rsrcName = schema;

        if ( $.isArray(role) ) {
            _.each(role, function(el) {
                if ( ! statusTree[el] )
                    statusTree[el] = {};
                eachRole(statusTree[el], schema, typ, rsrcName, priv, stat);
            })
        }
        else {
            if ( ! statusTree[role] )
                statusTree[role] = {};
            eachRole(statusTree[role], schema, typ, rsrcName, priv, stat);
        }
    }

    function eachRole(roleHash, schema, typ, rsrcName, priv, stat) {

        if ( schema === '*' )
            schema = NAMED_SCHEMATA;

        if ( $.isArray(schema) ) {
            _.each(schema, function(el) {
                if ( ! roleHash[el] )
                    roleHash[el] = {};
                eachSchema(roleHash[el], typ, rsrcName, priv, stat);
            })
        }
        else {
            if ( ! roleHash[schema] )
                roleHash[schema] = {};
            eachSchema(roleHash[schema], typ, rsrcName, priv, stat);
        }
    }

    function eachSchema(schHash, typ, rsrcName, priv, stat) {

        if ( typ === '*' )
            typ = ALL_PRIVS.keys();

        if ( $.isArray(typ) ) {
            _.each(typ, function(el) {
                if ( ! schHash[el] )
                    schHash[el] = {};
                eachType(schHash[el], rsrcName, priv, stat);
            })
        }
        else {
            if ( ! schHash[typ] )
                schHash[typ] = {};
            eachType(schHash[typ], typ, rsrcName, priv, stat);
        }
    }

    function eachType( typHash, typ, rsrcName, priv, stat ) {

        if ( priv === '*' )
            priv = ALL_PRIVS[typ];

        if ( $.isArray(priv) ) {
            _.each(priv, function(el) {
                if ( ! typHash[el] )
                    typHash[el] = {};
                eachPriv(typHash[el], rsrcName, stat);
            })
        }
        else {
            if ( ! typHash[priv] )
                typHash[priv] = {};
            eachPriv(typHash[priv], rsrcName, stat);
        }
    }

    function eachPriv( privHash, rsrcName, stat ) {

        if ( ! privHash[rsrcName] )
            privHash[rsrcName] = stat;
        else {
            privHash[rsrcName] = strongest_of(privHash[rsrcName], stat);
        }
    }

    function strongest_of(stat0, stat1) {

        var s = [ stat0, stat1 ],
            ref = ['must','must-not','should','should-not'];

        _.each(ref, function (el) {

            if ( _.contains(s, el))
                return el;
        });

        return 'something seriously wrong happened '+s.join(',');
    }

    _.each(MANDATORY, function (el) {
        eachRequirement(el[0], el[1], el[2], el[3], el[4], 'must');
    });

    _.each(RECOMMENDED, function (el) {
        eachRequirement(el[0], el[1], el[2], el[3], el[4], 'should');
    });

    _.each(DISCOURAGED, function (el) {
        eachRequirement(el[0], el[1], el[2], el[3], el[4], 'should-not');
    });

    _.each(FORBIDDEN, function (el) {
        eachRequirement(el[0], el[1], el[2], el[3], el[4], 'must-not');
    });

}

var statuser = new Statuser();

function get_safety_flag_for_resource(schema, name, typ, role, priv, yes) {

    // returns 'warn', 'ok', or 'recommend'
    var r = statuser.statusOf(schema,name,typ,role,priv),
        res = '';

    if ( r === 'must' )
        res = 'safety-mandate';
    else if ( r === 'should' )
        res = yes ? '' : 'safety-rec';
    else if ( r === 'should-not' )
        res = yes ? 'safety-warn' : '';
    else if ( r === 'must-not' )
       res = 'safety-ban';
    return res || '';
}


function PermissionsPanel(rdbAdmin, dbMgr) {
    this.panelId = 'permissions-panel';
    var that = this;

    // function to handle error result of query submit
    function errback(err) {
        rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
    }


    this.init_handlers = function (app) {
        // bind handlers to create button, and to form submit buttons
        $('#permissionsBtn').click( function(){
            app.setLocation('#/permissions');
        });
    };

    var roleNamesDict = {'s' : 'super',
                         'a' : 'auth',
                         'p' : 'preauth',
                         'r' : 'read'  };


    function evalPrivs(syms) {
        // arwdDxt
        var codes = _.chars(syms.split('/')[0]);
        return _.map(codes, function(el) { return PRIV_CODES[el] });
    }


    function onChange ($panel) {

        var sqlQuery;
        style_table($panel);

        setTimeout(function () {
            _buildSQL();
            setTimeout(_postNotice, 10);
        }, 10);

        function _buildSQL() {
            var $pane = $('#permissions-sql-show');
            sqlQuery = buildSQLStatement($panel);

            if ( sqlQuery )
                $pane.text(sqlQuery);
            else
                $pane.text('-- nothing to show');
        }

        function _postNotice() {
            if ( $('.safety-warn',$panel).length )
                rdbAdmin.showWorkingMessage('One or more privileges are displayed in red. '+
                    'These are inappropriate to role or resource, and '+
                    'you should consider carefully whether you need them.');
            else if ( ~sqlQuery.indexOf('TO public') )
                rdbAdmin.showWorkingMessage('You have some privileges GRANTED to "public" for '+
                    'tables or views.  This is discouraged, and these '+
                    'privileges will be removed when you save.');
            else
                rdbAdmin.showWorkingMessage('');
        }
    }


    function saveFunction() {

        var query = buildSQLStatement();

        if ( query.length === 0 ) {
            return false;
        }

        // functions to handle results of query submit
        function errback (err,msg) {
            rdbAdmin.showErrorMessage('<pre>'+err[0] + ':' + err[1]+'</pre>');
        }

        function callback(json) {
            that.show();
          var ct = (json.row_count && json.row_count[1]) || 0;
            rdbAdmin.showWorkingMessage('<pre>Success '+ct+'</pre>');
            //$('#permissions-sql-show').text('');
        }

        // send query to engine, feed results to callback
        dbMgr.sqlEngine.query({
            'q' : query,
            'callback' : callback,
            'errback' : errback
        });

        return false;
    }


    this.show = function () {

        var $panel = $('#' + this.panelId);
        $panel.hide();
        rdbAdmin.onStartQueryExecution();

        dbMgr.getPrivileges(function (d) {

            var dbRolesString = d.result_sets[0].records.rows[0][0],
                resourceRoles = d.result_sets[1],
                roles = [];

            // "{s0000000842=CTc/admin,r0000000842=c/admin,admin=CTc/admin}"
            var connectPrivs = _.trim(dbRolesString,"{}").split(',');

            _.each(connectPrivs, function (el) {
                var priv = el.split('=')[0];
                if ( /[a-zA-z]\d{10}/.test(priv))
                    roles.push(roleNamesDict[priv[0]]);
            });

            var schemaData = {};

            _.each(resourceRoles.records.rows, function (row) {
                // nm, schema, type, privs, owner
                var nm = row[0], sch = row[1], typ = row[2], privStr=row[3], owner = row[4],
                    privs = {}, rec;

                if ( privStr === null ) {
                    privs['super'] = ALL_PRIVS[typ];
                }

                else {
                    var resourcePrivs = _.trim(privStr,"{}").split(',');
                    _.each(resourcePrivs, function (el) {
                        var privParts = el.split('='),
                            priv = privParts[0], codes = privParts[1],
                            rol;
                        if ( /[a-zA-z]\d{10}/.test(priv) ) {
                            rol = roleNamesDict[priv[0]];
                            privs[rol] = evalPrivs(codes);
                        }
                        else if ( priv === '' ) {
                            privs['_public_'] = evalPrivs(codes);
                        }
                    });
                }

                // put record into schemaData data aggregate
                if ( ! schemaData[sch] )
                  schemaData[sch] = {};
                if ( ! schemaData[sch][typ] )
                  schemaData[sch][typ] = [];

                // remove schema-name from function long-name
                if ( typ === 'function' ) {

                    var parts = nm.split('.');
                    if ( parts[0] === sch )
                      nm = nm.substr(sch.length+1);
                }

                // create record
                rec = [typ, nm, sch, owner, privs];
                schemaData[sch][typ].push(rec);
            });

            // build the permissions table
            build_table($panel, roles, schemaData);
            preset_table($panel);
            style_table($panel);

            // add change handler to respond to changes
            $panel.on('change', function () { onChange($panel) });
            $panel.find('#permissions-save-btn').click( saveFunction );
            setTimeout(function() { $panel.change() }, 1);

            // later
            rdbAdmin.onStopQueryExecution();
            $panel.show();
            rdbAdmin.setHeading("Permissions ");
        });

    };

    // build_table - builds table, with provided data
    function build_table($panel, roles, schemaData) {

        var $tHead = $('thead',$panel),
            $tHdrRow = $('tr:first',$tHead);

        // put aprop captions in table header
        _.each(ALL_ROLES, function (rol) {
           $('.'+rol+'-role',$tHead).text(_.include(roles,rol) ? rol.toUpperCase() : rol);
        });

        // capture body and sample rows
        var $tBody = $('tbody',$panel),
            $tblRow = $('.perm-row',$tBody).remove().first(),
            $subHdrRow = $('.sub-row',$tBody).remove().first();
        $tBody.empty();

        // injects html into html row, to represent 'priv' for 'role'
        //  'sel' indicates whether priv has been granted
        //
        function inject_priv_span(priv,rol,$tRow,sel) {

            var $cell = $tRow.find('.'+rol+'-role:first'),
                $superLbl = $('<label><input type="checkbox" value="on"><input type="hidden"><span></span></label>'),
                $cBox = $('input:checkbox',$superLbl),
                $prevVal = $('input:hidden',$superLbl);
            if (sel) {
                $cBox.prop('checked',true);
                $prevVal.val('on')
            }
            $cBox.attr('name', rol+'-'+priv);
            $prevVal.attr('name', rol+'-'+priv);
            $superLbl.find('span').text(priv);
            $cell.append($superLbl);
        }

        // puts collection of privs into an html row
        //
        function add_priv_spans_to_row(privHash,$tRow,typ) {

            var rolPrivs;

            // put html markup into given row, for given privs
            //
            _.each(ALL_ROLES, function(rol) {

                if ( _.contains(roles,rol) ) {

                    rolPrivs = privHash[rol] || []; // array of privs
                    _.each(ALL_PRIVS[typ], function (priv) {

                        inject_priv_span(priv,rol,$tRow,_.contains(rolPrivs,priv));
                    });
                }
            });

            // put markup into hidden '_public_' column, to record
            //  privs granted (somehow) to postgres 'public' role
            //
            if ( privHash['_public_'] ) {

                rolPrivs = privHash['_public_'];
                _.each(rolPrivs, function (priv) {

                    inject_priv_span(priv,'_public_',$tRow,true);
                });
            }

            // clear any checkboxes in the _public_ column, so only hidden
            //  prevVal fields persist
            //
            $('td._public_-role input:checkbox',$tRow).prop('checked',false);
            $('th._public_-role input:checkbox',$tRow).prop('checked',false);

            // disable check boxes in super column
            //
            $('td.super-role input:checkbox',$tRow).attr('disabled',true);
            $('th.super-role input:checkbox',$tRow).attr('disabled',true);

            // disable insert|update|delete checkboxes in read column
            //  after forcing off
            //
            var $tdR = $("td.read-role label:has(span:contains('insert'))",$tRow)
                .add("td.read-role label:has(span:contains('update'))",$tRow)
                .add("td.read-role label:has(span:contains('delete'))",$tRow);
            $tdR.find('input:checkbox').attr('disabled',true).prop('checked',false);

        }

        // adds schema header for 'public' schema
        function add_public_header() {

            var $tSubHdr = $tHdrRow.clone();
            $tBody.append($tSubHdr);
            $tSubHdr.find('th').text(' ');
            $tSubHdr.find('th:first').text('Schema: public');
        }

        // adds schema header for schema described in row
        //
        function add_schema_header(sch) {

            var schName = sch[1], privHash = sch[4], typ = sch[0],
                $tSubHdr = $tHdrRow.clone();
            $tSubHdr.find('th').text(' ');

            var $thFirst = $tSubHdr.find('th:first');
            $thFirst.text('Schema: '+schName);

            $thFirst.append('<input type="hidden" name="type">');
            $thFirst.find('input[name=type]').val(typ);
            $thFirst.append('<input type="hidden" name="schema">');
            $thFirst.find('input[name=schema]').val(schName);

            add_priv_spans_to_row(privHash,$tSubHdr,typ);

            $tBody.append($tSubHdr);
        }

        // adds schema header for schema described in row
        //
        function add_sub_sub_header(title) {

            var $tSubHdr = $subHdrRow.clone();
            //$tSubHdr.find('td').text(' ');
            title = title.charAt(0).toUpperCase() + title.substr(1);
            $tSubHdr.find('td:first-child').text(title);
            $tBody.append($tSubHdr);
        }

        // adds html row to permissions panel table
        //   stores schema and type in hidden fields in name column
        function add_table_row(tblData) {

            var typ = tblData[0], tName = tblData[1], schName = tblData[2],
                tOwner = tblData[3], tPrivs = tblData[4],
                $tRow = $tblRow.clone();
            $tRow.find('td').text('');
            var $tdFirst = $tRow.find('td:first');
            $tdFirst.text(tName);
            $tdFirst.append('<input type="hidden" name="type">');
            $tdFirst.find('input[name=type]').val(typ);
            $tdFirst.append('<input type="hidden" name="schema">');
            $tdFirst.find('input[name=schema]').val(schName);

            add_priv_spans_to_row(tPrivs,$tRow,typ);

            $tBody.append($tRow);
        }

        /*
          iterate over schemata in schemaData
         */
        _.each(schemaData, function(dta, schemaName) {

            // add line to html table for schema privs
            if ( schemaName === 'public' ) {
                add_public_header();
            }
            else {
                var sch = dta.schema[0];
                add_schema_header(sch);
            }

            // handle tables in schema, one row per table
            if ( dta.table ) {
                add_sub_sub_header('tables');
                var tables = dta.table;
                _.each(tables, function(tblData) {
                    add_table_row(tblData);
                })
            }

            // handle views in schema, one row per view
            if ( dta.view ) {
                add_sub_sub_header('views');
                var views = dta.view;
                _.each(views, function(tblData) {
                    add_table_row(tblData);
                })
            }

            // handle sequences in schema, one row per seq
            if ( dta.sequence ) {
                add_sub_sub_header('sequences');
                var sequences = dta.view;
                _.each(sequences, function(tblData) {
                    add_table_row(tblData);
                })
            }

            // handle functions in schema, one row per function
            if ( dta.function ) {
                add_sub_sub_header('functions');
                var functs = dta.function;
                _.each(functs, function(tblData) {
                    add_table_row(tblData);
                })
            }

        });
    }

    /*
     *   style_table - scans table, and adds styling
     */
    function style_table($panel) {

        // capture body and sample row
        var $tBody = $('tbody',$panel);

        var $allResources = $('tr:has(td:first-child input:hidden)',$tBody)
                            .add('tr:has(th:first-child input:hidden)',$tBody);
        $allResources.each( function(i, row) {

            var $row = $(row),
                $firstCell = $row.find('td:first');
            if ( ! $firstCell.length )
                $firstCell = $row.find('th:first');
            var resourceName = $firstCell.text(),
                resourceType = $firstCell.find('input[name="type"]').val(),
                resourceSchema = $firstCell.find('input[name="schema"]').val();
            if ( resourceType === 'schema' )
                resourceName = resourceSchema;

            var $allLabels = $('label',$row);
            $allLabels.each(function(i, lbl) {

                var $lbl = $(lbl),
                    newVal = !!$('input:checkbox',$lbl).prop('checked'),
                    $text = $lbl.find('span');

                var roleNPriv = $('input:hidden',$lbl).attr('name').split('-'),
                    role = roleNPriv[0],
                    priv = roleNPriv[1];
                $text.text( newVal ? priv.toUpperCase() : priv.toLowerCase() );

                $text.removeClass('safety-ok safety-warn safety-rec');
                var flag = get_safety_flag_for_resource(resourceSchema, resourceName, resourceType,
                                                        role, priv, newVal);
                if ( flag.length ) {
                    switch (flag) {
                        case 'safety-mandate':
                            if ( ! newVal )
                                $text.addClass('safety-rec');
                            break;
                        case 'safety-rec':
                            $text.addClass('safety-rec');
                            break;
                        case 'safety-ban':
                            if ( newVal )
                                $text.addClass('safety-warn');
                            break;
                        case 'safety-warn':
                            $text.addClass('safety-warn');
                            break;
                    }
                }
            });
        })
    }

    /*
     *   preset_table - scans table, and checks 'mandatory' boxes
     */
    function preset_table($panel) {

        // capture body
        var $tBody = $('tbody',$panel);

        var $allResources = $('tr:has(td:first-child input:hidden)',$tBody)
            .add('tr:has(th:first-child input:hidden)',$tBody);
        $allResources.each( function(i, row) {

            var $row = $(row),
                $firstCell = $row.find('td:first');
            if ( ! $firstCell.length )
                $firstCell = $row.find('th:first');
            var resourceName = $firstCell.text(),
                resourceType = $firstCell.find('input[name="type"]').val(),
                resourceSchema = $firstCell.find('input[name="schema"]').val();
            if ( resourceType === 'schema' )
                resourceName = resourceSchema;

            var $allLabels = $('label',$row);
            $allLabels.each(function(i, lbl) {

                var $lbl = $(lbl),
                    $cBox = $('input:checkbox',$lbl),
                    $text = $lbl.find('span'),
                    roleNPriv = $('input:hidden',$lbl).attr('name').split('-'),
                    role = roleNPriv[0],
                    priv = roleNPriv[1];

                var flag = get_safety_flag_for_resource(resourceSchema, resourceName, resourceType,
                    role, priv, !!$cBox.prop('checked'));
                if ( flag.length ) {
                    switch (flag) {
                        case 'safety-mandate':
                            $cBox.prop('checked',true);
                            $cBox.attr('disabled',true);
                            break;
                        case 'safety-ban':
                            $cBox.prop('checked',false);
                            $cBox.attr('disabled',true);
                            break;
                    }
                }
            });
        })
    }


    function buildSQLStatement($panel) {
        var sql = [],
            acctNum = dbMgr.sqlEngine.userName().substring(1);

        function true_role_name(rName) {
            return rName.charAt(0)+acctNum;
        }

        function grant_priv(priv, role, typ, sch, name) {
            var q;
            if ( typ === 'function' )
                q = 'GRANT '+priv.toUpperCase()+' ON '+typ.toUpperCase()+
                    ' "'+sch+'".'+name+' TO '+true_role_name(role);
            else if ( typ === 'schema' )
                q = 'GRANT '+priv.toUpperCase()+' ON '+typ.toUpperCase()+
                    ' "'+sch+'" TO '+true_role_name(role);
            else if ( typ === 'view' )
                q = 'GRANT '+priv.toUpperCase()+' ON '+'/* VIEW */'+
                    ' "'+sch+'"."'+name+'" TO '+true_role_name(role);
            else
                q = 'GRANT '+priv.toUpperCase()+' ON '+typ.toUpperCase()+
                    ' "'+sch+'"."'+name+'" TO '+true_role_name(role);
            sql.push(q);
        }

        function revoke_priv(priv, role, typ, sch, name) {
            var roleName, q;
            if ( role === '_public_' )
                roleName = 'public';
            else
                roleName = true_role_name(role);
            if ( typ === 'function' )
                q = 'REVOKE '+priv.toUpperCase()+' ON '+typ.toUpperCase()+
                    ' "'+sch+'".'+name+' FROM '+roleName;
            else if ( typ === 'view' )
                q = 'REVOKE '+priv.toUpperCase()+' ON '+'/* VIEW */'+
                    ' "'+sch+'"."'+name+'" FROM '+roleName;
            else
                q = 'REVOKE '+priv.toUpperCase()+' ON '+typ.toUpperCase()+
                ' "'+sch+'"."'+name+'" FROM '+roleName;
            sql.push(q);
        }

        var $allResources = $('tr:has(td:first-child input:hidden)',$panel)
                            .add('tr:has(th:first-child input:hidden)',$panel);
        $allResources.each( function(i, row) {

            var $row = $(row),
                $firstCell = $row.find('td:first');
            if ( ! $firstCell.length )
                $firstCell = $row.find('th:first');

            var resourceName = $firstCell.text(),
                resourceType = $firstCell.find('input[name="type"]').val(),
                resourceSchema = $firstCell.find('input[name="schema"]').val();
            if ( resourceType === 'schema' )
                resourceName = resourceSchema;

            var $allLabels = $('label',$row);
            $allLabels.each(function(i, lbl) {
                var $lbl = $(lbl),
                    prevVal = !!$('input:hidden',$lbl).val(),
                    newVal = !!$('input:checkbox',$lbl).prop('checked');

                if ( newVal !== prevVal  ){
                    var roleNPriv = $('input:hidden',$lbl).attr('name').split('-'),
                        role = roleNPriv[0],
                        priv = roleNPriv[1];
                    if ( newVal ) {
                        grant_priv(priv, role, resourceType, resourceSchema, resourceName);
                    }
                    else if ( prevVal ) {
                        if ( role !== '_public_' )
                            revoke_priv(priv, role, resourceType, resourceSchema, resourceName);
                        else {
                            if ( _.contains(['table','view'], resourceType ) ) {
                                revoke_priv(priv, role, resourceType, resourceSchema, resourceName);
                            }
                        }
                    }
                }
            });
        });

        return sql.join(';\n');
    }

}
