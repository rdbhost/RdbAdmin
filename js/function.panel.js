/*

 handles interface for showing and editing function definitions

 */


var DEFAULT_PLPGSQL_FUNCTION_DEFINITION = 'BEGIN\n\nEND;\n',
    DEFAULT_SQL_FUNCTION_DEFINITION = '\n',
    DEFAULT_PLV8_FUNCTION_DEFINITION = '\n';


function FunctionPanel(rdbAdmin, databaseManager, sqlPanel, receditPanel) {

    this.panelId = 'create-function-panel';
    var mode = 'create',
        funcName = '',
        funcMeta = '',
        maxRowId = 0,
        funcOid = undefined,
        typeInfo = '',
        that = this;

    // function to handle error result of query submit
    function errback(err) {
        rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
    }

    this.init_handlers = function (app) {
        var $panel = $('#' + this.panelId);

        $('#createNewFunctionBtn').click(function () {
            app.setLocation('#/createfunction');
        });
        $('#save-function-btn').click(function (ev) {
            ev.stopPropagation();
            saveFunction();
        });
        $('#drop-function-btn').click(function (ev) {
            ev.stopPropagation();
            dropFunction();
        });

        // handlers for add and delete, up/down row butons
        $panel.on('click', '.function-del-row', function () {
            delRow(this);
        });
        $panel.on('click', '.function-add-row', function () {
            addRow(this);
        });
        $panel.on('click', '.function-row-down', function () {
            rowDown(this);
        });
        $panel.on('click', '.function-row-up', function () {
            rowUp(this);
        });
        $panel.on('change', '*:input', function () {
            onChange(this);
        });

        // add click handler to edit query
        $('.edit-sql-btn', $panel).click(function (ev) {
            ev.stopPropagation();
            var queryObj = createQueryString();
            sqlPanel.showQueryLater(queryObj);
            rdbAdmin.loadNewPage('#/sqlcommand');
        });
    };

    this.show = function (mod, fnam) {

        function initialOnChange() {

            // put initial change-query in form
            var initQuery = createQueryString();
            $('#old-sql-function-create-query').val(initQuery.query);
            // run onChange handler for each row, to set visibilities
            $('#' + that.panelId + ' tbody tr:visible').each(function () {
                onChange(this);
            });
        }

        if (!rdbAdmin.isLoggedIn()) {
            alert('please login');
            return false;
        }

        mode = mod;
        funcMeta = new ResourceMeta(fnam);
        cleanParamsTable();

        if (mode === 'edit') {

            rdbAdmin.setHeading("Alter function: " + funcMeta.qualResourceName());
            loadFunctionDetails(initialOnChange);
            $('#drop-function-btn').css('display', 'inline');
        }
        else {

            rdbAdmin.setHeading("Create Function");
            $('#drop-function-btn').css('display', 'none');
            $('#function-name').val('');
            $('#schema-name').val('');
            $('#old-function-name').val('');
            $('#old-schema-name').val('');
            $('#function-definition').val(DEFAULT_PLPGSQL_FUNCTION_DEFINITION);
            $('#old-sql-function-create-query').val('');

            onChange();
        }

        rdbAdmin.showPanel(that.panelId);
        return true;
    };

    function loadFunctionDetails(doAfter) {
        var $panel = $('#' + that.panelId);
        //

        function withFuncDetails(json) {

            assert(json && json.length, 'no data');
            var funcData = json[0],
            // load argument types
                retIsSet = funcData[4], volatil = funcData[5],
                retType = funcData[7],
                argTypes = funcData[8], typeOidSet = funcData[9],
                argModes = funcData[10], argNames = funcData[11],
                definition = funcData[12], isAggregate = funcData[13],
                secDefiner = funcData[14], isStrict = funcData[15],
                langName = funcData[17],
                typeOids = [];

            funcOid = funcData[1];
            funcMeta = new ResourceMeta(funcData[0]);

            if (typeOidSet) {
                typeOids = typeOids.concat(typeOidSet);
            }
            else if (argTypes.length) {

                var aT = argTypes.split(' ');
                var aT1 = [];
                for (_a in aT) {
                    aT1.push(parseInt(aT[_a], 10));
                }
                typeOids = typeOids.concat(aT);
            }

            if (!argModes) {
                argModes = [];
                for (var _t0 in typeOids) {
                    argModes.push('i');
                }
            }

            if (!argNames) {
                argNames = [];
                for (var _t1 in typeOids) {
                    argNames.push('');
                }
            }

            function stripLeftIndent(def) {

                var nl = /^\s*\n/.exec(def);
                while (nl && nl.length) {
                    def = def.replace(/^\s*\n/, '');
                    nl = /^\s*\n/.exec(def);
                }

                var lead = /^\s+/.exec(def);
                if (lead && lead.length) {
                    def = def.replace(new RegExp("^\\s{" + lead[0].length + '}', ""), '');
                    def = def.replace(new RegExp("\n\\s{" + lead[0].length + '}', "g"), '\n');
                }
                return def;
            }

            function withTypeInfo(tInfo) {

                typeInfo = tInfo[0];
                for (var ti in typeInfo) {
                    typeInfo[ti] = typeInfo[ti].replace(/^\((\S*(\s+\S+)*)\)$/, "$1");
                    typeInfo[ti] = typeInfo[ti].split(',');
                }

                // name
                $('#function-name').val(funcMeta.getFunctionNameOnly());
                $('#old-function-name').val(funcMeta.getFunctionNameOnly());
                $('#schema-name').val(funcMeta.getSchemaNameOnly());
                $('#old-schema-name').val(funcMeta.getSchemaNameOnly());

                // definition
                $('#function-definition').val(stripLeftIndent(definition.replace(/%/g, '%%')));
                $('#' + {'v': 'volatile', 's': 'stable', 'i': 'immutable'}[volatil]).prop('checked', true);
                $('#' + (secDefiner ? 'definer' : 'invoker')).prop('checked', true);
                $('#' + (isStrict ? 'strict' : 'nullok')).prop('checked', true);
                $('#lang' + langName).prop('checked', true);

                // add function params to html table
                var $rowRef = $('#function-param-tr_');
                for (var i = 0; i < typeInfo.length - 1; i += 1) {
                    var aMod = {'o': 'OUT', 'i': 'IN', 'b': 'INOUT', 'v': 'VARIADIC', 't': 'TABLE'}[argModes[i]];
                    var vals = {
                        ftype: typeInfo[i][1],
                        pname: argNames[i],
                        mode: aMod
                    };
                    $rowRef = addRow($rowRef, vals);
                }

                // set return type
                $('#function-return-setof').prop('checked', retIsSet);
                var retType = typeInfo[i][1], newOpt;
                $panel.find('#function-ftype_999999').val(retType);
                if ($panel.find('#function-ftype_999999').val() !== retType) {
                    newOpt = $('<option>').html(retType);
                    $panel.find('#function-ftype_999999').append(newOpt);
                    $panel.find('#function-ftype_999999').val(retType);
                }

                doAfter();
            }

            // add return type to type list
            typeOids.push(retType);

            // get type info, call withTypeInfo to finish
            databaseManager.getTypeByOID(typeOids, withTypeInfo);
        }

        // load function details
        databaseManager.getFunctionsList(funcMeta.qualResourceName(), withFuncDetails);
    }

    function cleanParamsTable() {
        var $panel = $('#' + that.panelId),
            $body = $panel.find('tbody:eq(1)'),
            $oneRow = $body.find('tr:first').remove(),
            $returnRow = $body.find('tr:last').remove();
        $returnRow.find('select').val('void');
        $body.empty()
            .append($oneRow.hide())
            .append($returnRow.show());
        maxRowId = 1;
    }

    function setInputVisibility() {
        var $form = $('#' + that.panelId),
            $body = $form.find('tbody');
        if (mode === 'edit') {
            $body.find('input:image').css('visibility', 'hidden');
        }
        else {
            $body.find('.function-row-up')
                .add('.function-row-down', $body)
                .css('visibility', 'visible').show();
            $body.find('tr:not(:last):last input.function-row-down')
                .css('visibility', 'hidden');
            $body.find('tr:visible:first input.function-row-up')
                .css('visibility', 'hidden');
        }
        $body.find('tr:visible').each(function () {
            onChange(this);
        });
    }

    function addRow(element, vals) {
        var $form = $('#' + that.panelId),
            $body = $form.find('tbody:eq(1)'),
            sampleRowId = "function-param-tr_",
            newRowID = maxRowId + 1,
        // clone sample row
            $tRow = $body.find('#' + sampleRowId).clone();
        // function to add row# to end of id values
        function update_row_ids($row, i) {
            var reg = /(\S+)_(\d*)$/;

            function update_one_elem() {
                var $el = $(this),
                    id = $el.attr('id');
                if (id && id.length && reg.test(id)) {
                    id = id.replace(reg, '$1_' + i);
                    $el.attr('id', id);
                }
            }

            $row.each(update_one_elem);
            $row.find('td')
                .add('select', $row)
                .add('input', $row)
                .each(update_one_elem);
        }

        // reveal table row
        $tRow.css('display', '');
        // insert new ids for selects
        update_row_ids($tRow, newRowID);
        $tRow.find('input[id^="param-name_"]').val('');
        function patchFieldType(fType) {
            if (fType == 'bool')
                return 'boolean';
            else
                return fType;
        }

        // put data into row, if editing
        if (mode === 'edit') {
            if (vals) {
                // populate with values
                $tRow.find('select[id^="function-param-mode_"]').val(vals.mode);
                $tRow.find('select[id^="function-ftype_"]').val(patchFieldType(vals.ftype.toString()));
                $tRow.find('input[id^="param-name_"]').val(vals.pname);
            }
        }
        // insert new row
        var $curRow = $(element).closest('tr');
        if ($curRow.attr('id') === 'function-param-head-row') {
            // add row to the end
            $form.find('#function-param-tr_999999').before($tRow);
        }
        else {
            // add row after current
            $curRow.after($tRow);
        }
        setInputVisibility();
        maxRowId += 1;
        return $tRow;
    }

    function delRow(element) {
        $(element).closest('tr').remove();
        setInputVisibility();
    }

    function onChange(domel) {
        var $elem = $(domel),
            $row = $elem.closest('tr'),
            $typeSelect = $row.find('td:eq(1) select');
        // if selected elem is in row...
        if ($typeSelect.length) {
            var idRe = /^function-ftype_(\d+)$/,
                tmpId = $typeSelect.attr('id'),
                id = idRe.exec(tmpId)[1],
            // make size visible or not, depending on type
                lenVis = takes_length($typeSelect.val()) ? 'visible' : 'hidden';
            $row.find('#function-param-length_' + id).css('visibility', lenVis);
            // if default vals allowed for this tpe
            var $defSelectVal = $row.find('td:first select').val(),
                defVis = $.inArray($defSelectVal, ['IN', 'INOUT']) > -1 ? 'visible' : 'hidden';
            $row.find('#function-default_' + id).css('visibility', defVis);
        }
        updateSQLDisplay();
    }

    function rowUp(domel) {
        // find ref row and row above
        var $row = $(domel).closest('tr'),
            $rowAbove = $row.prev();
        // if top row, do nothing
        if ($rowAbove.attr('id') === 'function-param-tr_') {
            return false; // we can't place first row upper :)
        }
        $row.insertBefore($rowAbove);
        setInputVisibility();
        return true;
    }

    function rowDown(domel) {
        // find ref row and row above
        var $row = $(domel).closest('tr'),
            $rowBelow = $row.next();
        // if bottom row, do nothing
        if ($rowBelow.attr('id') === 'function-param-tr_999999') {
            return false;
        }
        $rowBelow.after($row);
        setInputVisibility();
        return true;
    }

    function updateSQLDisplay() {
        var queryObj = createQueryString(),
            $panel = $('#' + that.panelId),
            retType = $('#function-ftype_999999').val(),
            oldCreateQuery = $('#old-sql-function-create-query').val();
        if (queryObj.query === oldCreateQuery) {
            $('#alter-function-sql-show').text('-- nothing to show');
            $('.edit-sql-btn', $panel).addClass('disabledBtn')
                .attr('disabled', 'disabled');
        }
        else {
            $('#alter-function-sql-show').text(queryObj.query);
            $('.edit-sql-btn', $panel).removeClass('disabledBtn')
                .removeAttr('disabled');
        }
        if ((!queryObj.query) || queryObj.status === 'edit-needed') {
            $('#save-function-btn', $panel).addClass('disabledBtn')
                .attr('disabled', 'disabled');
            if (queryObj.query) {
                $('.edit-needed-note', $panel).show();
            }
        }
        else {
            $('#save-function-btn', $panel).removeClass('disabledBtn')
                .removeAttr('disabled');
            $('.edit-needed-note', $panel).hide();
        }
        if (retType === 'trigger') {
            $('.trigger-note', $panel).show();
        }
        else {
            $('.trigger-note', $panel).hide();
        }
        // alert($('#alter-function-sql-show').html());
    }

    function make_param_string(mod, nm, typ, length) {
        var data = '~mod~ ~nm~ ~typ~~len~';
        length = length ? '(' + length + ')' : '';
        data = data.replace('~mod~', mod)
            .replace('~nm~', nm)
            .replace('~typ~', typ)
            .replace('~len~', length);
        if (data.substr(0,1) === ' ')
            data = data.substr(1);
        return data;
    }

    function make_complete_def_query_string(oldSchema, schemaName, oldName, funcName, params,
                                            definit, returns, volatil, secdef, isStrict, langName) {
        var paramstr = '(' + params.join(', ') + ')',
            sql0 = '', sql, delim = '$$';
        var oldMeta = new ResourceMeta();
        oldMeta.nameResource(oldSchema, oldName);
        var newMeta = new ResourceMeta();
        newMeta.nameResource(schemaName, funcName);
        var midMeta = new ResourceMeta();
        midMeta.nameResource(oldSchema, funcName);
        while (definit.indexOf(delim) !== -1) {
            delim = delim.replace(/.$/, 'z$');
        }
        if (oldSchema && oldSchema !== schemaName) {
            sql0 = "ALTER FUNCTION " + oldMeta.quotedResourceName()
                + '(' + params.join(', ') + ')\n'
                + '     SET SCHEMA ' + newMeta.getSchemaNameOnly() + ';\n';
        }
        if (oldName && oldName !== funcName) {
            sql0 = "ALTER FUNCTION " + midMeta.quotedResourceName() + +'(' + params.join(', ') + ')\n'
                + '     RENAME TO ' + quoteIdentifier(funcName) + ';\n';
        }
        sql = 'CREATE OR REPLACE FUNCTION ' + newMeta.quotedResourceName() + '\n'
            + '     ' + paramstr + '\n'
            + 'RETURNS ' + returns
            + '\nAS ' + delim + '\n'
            + definit + delim + '\n'
            + 'LANGUAGE ' + langName + ' ' + volatil + '\n'
            + 'SECURITY ' + secdef
            + (isStrict ? '\n' + isStrict : '')
            + ';\n';

        return sql0 + sql;
    }

    function createQueryString() {

        // create query string to manifest changes
        var $form = $('#' + that.panelId),
            $body = $form.find('tbody'),
            funcSchema = $form.find('#schema-name').val(),
            oldFuncSchema = $form.find('#old-schema-name').val(),
            funcName = $form.find('#function-name').val(),
            oldName = $form.find('#old-function-name').val(),
            definitn = $form.find('#function-definition').val(),
            retIsSet = $form.find('#function-return-setof').prop('checked') ? true : false,
            volatil = $('input[name="volatil"]:checked').val(),
            secdef = $('input[name="secdefiner"]:checked').val(),
            isStrict = $('input[name="strict"]:checked').val(),
            langName = $('input[name="lang"]:checked').val(),
            status = 'ok';

        // volatil = {'v':'VOLATILE', 's':'STABLE', 'i':'IMMUTABLE'}[volatil];
        if (!funcName && definitn === DEFAULT_PLPGSQL_FUNCTION_DEFINITION) {
            return {
                'query': '',
                'status': status
            };
        }
        if (!funcName) {
            funcName = '~function~';
            status = 'edit-needed';
        }
        // traversing through parameters
        var params = [], tableParams = [];
        $body.find('tr[id^="function-param-tr_"]').each(function () {
            // for each html row
            var $row = $(this),
                ids = $row.attr('id');
            if (ids === 'function-param-tr_999999') {
                return true; // skip if this is last row
            }
            var idre = /function-param-tr_(\d+)/;
            if (!idre.test(ids)) {
                // check that number found in row id, skip otherwise
                return true;
            }
            // extract data from form row
            var id = idre.exec(ids)[1],
                mod = $row.find('#function-param-mode_' + id).val(),
                pname = $row.find('#param-name_' + id).val(),
                parmtype = $row.find('#function-ftype_' + id).val(),
                length = $row.find('#function-param-length_' + id).val();
            // if any 'non-specific' types used, mark as edit-needed
            if (parmtype.indexOf('~') > -1) {
                status = 'edit-needed';
            }
            // create param string and add to params list
            if (mod == 'TABLE')
                tableParams.push(make_param_string('', pname, parmtype, length));
            else
                params.push(make_param_string(mod, pname, parmtype, length));
            return true;
        });

        // get various data fields from form
        var returns = $body.find('#function-ftype_999999').val(),
            retLength = $body.find('#function-param-length_999999').val(),
            retTableElements = [];
        if (tableParams.length) {

            returns = 'TABLE(' + tableParams.join(', ') + ')';
        }
        else {
            if (retLength) {
                returns = returns + '(' + retLength + ')';
            }
            if (retIsSet) {
                returns = 'SETOF ' + returns;
            }
        }

        // if any 'non-specific' types used, mark as edit-needed
        if (returns.indexOf('~') > -1) {
            status = 'edit-needed';
        }

        // create sql creation query from data
        definitn = definitn.replace(/\s*$/, '\n');
        var sql = make_complete_def_query_string(oldFuncSchema, funcSchema, oldName, funcName, params,
            definitn, returns, volatil, secdef, isStrict, langName);
        return {
            'query': sql,
            'status': status
        };
    }

    function saveFunction() {
        var //$panel = $('#'+that.panelId),
            funcName = $('#function-name').val(),
        //funcSchema = $('#schema-name').val(),
            definitn = $('#function-definition').val();

        if ((funcName === '') || (definitn === '')) {
            alert('Please fill all fields!');
            return false;
        }
        var queryObj = createQueryString();

        // functions to handle results of query submit
        function errback(err, msg) {
            rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
        }

        function callback() {
            rdbAdmin.loadNewPage('#/');
        }

        // send query to engine, feed results to callback
        databaseManager.sqlEngine.query({
            'q': queryObj.query,
            'callback': callback,
            'errback': errback
        });
        return false;
    }

    function dropFunction() {

        if (!confirm('Are you sure?') || !funcMeta) {
            return false;
        }

        var sql = "DROP FUNCTION " + funcMeta.qualResourceName();
        // functions to handle results of query submit
        function errback(err) {
            rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
        }

        function callback(json) {
            rdbAdmin.loadNewPage('#/');
        }

        // send query to engine, feed results to callback
        databaseManager.sqlEngine.query({
            'q': sql,
            'callback': callback,
            'errback': errback
        });
        return false;
    }
}


