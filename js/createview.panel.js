function CreateViewPanel(rdbAdmin, databaseManager, sqlPanel, receditPanel)
/* object to handle creation and renaming of views */ {
    this.panelId = 'create-view-panel';
    var mode = 'create',
    //view = '',
        meta = '',
        that = this;

    // function to handle error result of query submit
    function errback(err) {
        rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
    }

    this.init_handlers = function (app) {
        // bind handlers to create button, and to form submit buttons
        $('#createNewViewBtn').click(function () {
            app.setLocation('#/createview');
        });
        var $form = $('#' + this.panelId);
        $form.find('#create-view-btn').click(function (ev) {
            ev.stopPropagation();
            that.saveView();
        });
        $form.find('#drop-view-btn').click(function (ev) {
            ev.stopPropagation();
            that.dropView();
        });
        $('*:input', $form).change(function (ev) {
            ev.stopPropagation();
            updateSQL(ev);
        });
        $('.edit-sql-btn', $form).click(function (ev) {
            ev.stopPropagation();
            var queryObj = createQueryString();
            sqlPanel.showQueryLater(queryObj);
            rdbAdmin.loadNewPage('#/sqlcommand');
        });
        $('.lookup-create-link', $form).click(function (ev) {
            ev.stopPropagation();
            if (!$(this).is('.disabledLink')) {
                var queryObj = createQueryString();
                receditPanel.useRecordLater(queryObj);
                rdbAdmin.loadNewPage('#/browser/insert/' + encodeURIComponent('lookup.queries'));
            }
        });
    };

    this.show = function (mod, vw) {
        mode = mod;
        //view = vw;
        meta = new ResourceMeta();
        if (vw)
            meta.nameResource(vw);
        clearInputs();
        if (mod === 'edit') {
            $('#alter-view-tip').css('display', 'inline');
            $('#drop-view-btn').css('display', 'inline');
            loadViewDetails(updateSQL);
            $('#' + this.panelId + ' textarea').attr('disabled', 'disabled');
            rdbAdmin.setHeading("Alter View");
        } else {
            $('#alter-view-tip').css('display', 'none');
            $('#drop-view-btn').css('display', 'none');
            $('#' + this.panelId + ' textarea').removeAttr('disabled');
            rdbAdmin.setHeading("Create View");
            updateSQL();
        }
    };

    function clearInputs() {
        $('#' + that.panelId + ' input[type="hidden"]').val('');
        $('#' + that.panelId + ' input[type="text"]').val('');
        $('#' + that.panelId + ' textarea').val('');
        $('#create-view-sql-show').html('');
    }

    function updateSQL(ev) {
        var $panel = $('#' + that.panelId);
        var queryObj = createQueryString(false); // not count
        if (queryObj.query === '') {
            $('#create-view-sql-show', $panel).html('-- nothing to show');
            $('.edit-sql-btn', $panel).attr('disabled', 'disabled')
                .addClass('disabledBtn');
        }
        else {
            $('#create-view-sql-show', $panel).html(queryObj.query);
            $('.edit-sql-btn', $panel).removeAttr('disabled')
                .removeClass('disabledBtn');
        }
        if ((!queryObj.query) || queryObj.status === 'edit-needed') {
            $('#create-view-btn').addClass('disabledBtn');
            $('.lookup-create-link', $panel).addClass('disabledLink');
        }
        else {
            $('#create-view-btn').removeClass('disabledBtn');
            $('.lookup-create-link', $panel).removeClass('disabledLink');
        }
    }

    function loadViewDetails(callback) {
        //meta = new ResourceMeta(view);
        var schema = meta.getSchemaNameOnly(),
            vw = meta.getTableNameOnly();

        function cback(rows) {
            var $panel = $('#' + that.panelId),
                row = rows[0];

            if (rows.length > 0) {
                $('#view-name', $panel).val(vw);
                $('#view-name-hidden', $panel).val(vw);
                $('#view-schema', $panel).val(schema);
                $('#view-schema-hidden', $panel).val(schema);
                $('textarea', $panel).val(row[3]);
                callback();
            }
            else {
                errBack();
            }
        }

        function errBack(err, msg) {
            rdbAdmin.loadNewPage('#/createview');
        }

        databaseManager.getView(schema, vw, cback, errBack);
    }

    function createQueryString() {
        var name = $('#view-name').val(),
            oldName = $('#view-name-hidden').val(),
            sch = $('#view-schema').val(),
            oldSchema = $('#view-schema-hidden').val(),
            sql = $('#' + that.panelId + ' textarea').val(),
            query = "", status = 'ok', changes = [],
            newMeta = new ResourceMeta();
        if (sch === '') {
            sch = 'public';
        }
        if (name === '') {
            name = '~new view~';
            status = 'edit-needed';
        }
        newMeta.nameResource(sch, name);
        if (mode === 'edit') {
            var prefix = 'ALTER VIEW ' + meta.quotedResourceName() + ' ';
            if (sch !== oldSchema) {
                changes.push(prefix + 'SET SCHEMA ' + newMeta.quotedSchemaNameOnly());
            }
            if (name !== oldName) {
                changes.push(prefix + 'RENAME TO ' + newMeta.getTableNameOnly());
            }
            if (changes.length > 0) {
                query = changes.join(";\n");
            }
        }
        else {
            if (sql !== '') {
                query = 'CREATE VIEW ' + newMeta.quotedResourceName() + ' AS ' + sql;
            }
        }
        return {
            'status': status,   // ['ok', 'edit-needed']
            'query': query
        };
    }

    this.saveView = function () {
        // functions to handle results of query submit
        function errback(err, msg) {
            rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
        }

        function successcb(res) {
            rdbAdmin.showWorkingMessage(res.status[1]);
            rdbAdmin.updateViewList();
            // new name
            //view = name;
            rdbAdmin.loadNewPage('#/');
        }

        var schema = $('#schema-name').val();
        var name = $('#view-name').val();
        var sql = $('#' + this.panelId + ' textarea').val();
        meta = new ResourceMeta();
        meta.nameResource(schema, name);
        sql = sql.replace(/%/g, '%%');
        if ((name === '') || (sql === '')) {
            alert('Please fill all fields!');
            return;
        }
        var query = createQueryString();
        databaseManager.sqlEngine.query({
            'q': query.query,
            'callback': successcb,
            'errback': errback
        });
    };

    this.dropView = function () {
        var sql;
        // functions to handle results of query submit
        function errback(err, msg) {
            rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
        }

        function successcb(res) {
            rdbAdmin.showWorkingMessage(res.status[1]);
            rdbAdmin.updateViewList();
            rdbAdmin.loadNewPage('#/');
        }

        if (!confirm('Are you sure?')) {
            return false;
        }
        if (meta !== '') {
            sql = "DROP VIEW " + meta.quotedResourceName();
        }
        else {
            return false;
        }
        databaseManager.sqlEngine.query({
            'q': sql,
            'callback': successcb,
            'errback': errback
        });
        return false;
    };
}


//