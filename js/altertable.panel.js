/*

 code for altering tables (but not indexes)

 */

function logErrors(err) {
    console.log(err[0] + ' ' + err[1]);
}

/*
 takes_length takes type of argument, and returns whether
 type takes a size, like varchar(25)
 */
function takes_length(type) {

    switch (type) {
        case 'int':
        case 'integer':
        case 'bigint':
        case 'double precision':
        case 'float':
        case 'double':
        case 'serial':
        case 'bigserial':
        case 'real':
        case 'smallint':
        case 'boolean':
        case 'box':
        case 'bytea':
        case 'cidr':
        case 'circle':
        case 'date':
        case 'inet':
        case 'line':
        case 'lseg':
        case 'macaddr':
        case 'money':
        case 'path':
        case 'point':
        case 'polygon':
            return false;
        case 'bit':
        case 'bit varying':
        case 'numeric':
        case 'interval':
        case 'decimal':
        case 'character varying':
        case 'charvar':
        case 'character':
        case 'text':
        case 'tsquery':
        case 'tsvector':
        case 'txid_snapshot':
        case 'uuid':
        case 'xml':
            return true;
        default:
            return true;
    }
}

var KEEPSAMEVALUE = '~~ keep same ~~';

function AlterTablePanel(rdbAdmin, databaseManager, sqlPanel, receditPanel) {

    this.panelId = 'alter-table-panel';
    var tableId = 'alter-table-details',
        maxRowId = 0,
        mode = 'alter',
        tableMeta = undefined,
        tableIdentifier = undefined,
        that = this;

    // function to handle error result of query submit
    function errback(err) {

        rdbAdmin.showErrorMessage('<pre>' + err[0].toString() + ': ' + err[1] + '</pre>');
    }

    // initialize click handlers
    //
    this.init_handlers = function (app) {

        var $panel = $('#' + this.panelId);

        $('#createNewTableBtn').click(function (ev) {
            ev.stopPropagation();
            app.setLocation('#/createtable');
        });

        // add click handler to edit query
        $('#atable-sql-edit').click(function (ev) {
            var query = $('#alter-table-sql-show').html();
            sqlPanel.showQueryLater(query);
            app.setLocation('#/sqlcommand');
            ev.stopPropagation();
        });

        $('#atable-column-comments').click(function (ev) {
            showCommentsColumn(this);
            ev.stopPropagation();
        });

        $('#atable-column-defaults').click(function (ev) {
            showDefaultsColumn(this);
            ev.stopPropagation();
        });

        $('#alter-table-save').click(function (ev) {
            saveTable();
            ev.stopPropagation();
        });

        $('#alter-table-drop').click(function (ev) {
            dropTable();
            ev.stopPropagation();
        });

        $('#alter-table-add-row').click(function (ev) {
            addRowToTable(this);
            ev.stopPropagation();
        });

        // add live onclick handlers for rows (of varying number)
        // handlers for add and delete row butons
        $panel.on('click', 'input[id^="alter-table-del-row_"]', function (ev) {
            delRowFromTable(this);
            ev.stopPropagation();
        });

        // handler updates sql display for any change in the data entry
        $panel.bind('change', function (ev) {
            onChange(this);
            ev.stopPropagation();
        });

        $('.edit-sql-btn', $panel).click(function (ev) {
            var queryObj = getQueryString();
            sqlPanel.showQueryLater(queryObj);
            rdbAdmin.loadNewPage('#/sqlcommand');
            ev.stopPropagation();
        });

        $('.lookup-create-link', $panel).click(function (ev) {
            if (!$(this).is('.disabledLink')) {
                var queryObj = getQueryString();
                receditPanel.useRecordLater(queryObj);
                rdbAdmin.loadNewPage('#/browser/insert/' + encodeURIComponent('lookup.queries'));
            }
            ev.stopPropagation();
        });
    };

    function getTableDetls(callback) {

        function successcb(dtls) {
            tableMeta = dtls;
            callback();
        }

        tableMeta = new ResourceMeta(tableIdentifier);
        databaseManager.getTableDetails(tableMeta.getSchemaNameOnly(), tableMeta.getTableNameOnly(), successcb);
    }

    this.show = function (mod, tableName) {

        var $panel = $('#' + that.panelId);
        $panel.hide();
        $('#alter-table-comment').val('');
        rdbAdmin.setHeading('');
        mode = mod;
        tableIdentifier = tableName;
        tableMeta = undefined;

        if (mode === 'alter' && tableIdentifier) {

            getTableDetls(function () {

                if (mode === 'alter') {
                    rdbAdmin.setHeading("Alter table: " + tableMeta.qualResourceName());
                    $('#alter-table-drop').css('display', 'inline');
                }
                else {
                    rdbAdmin.setHeading("Create new table");
                    rdbAdmin.setHeading("Create new table");
                    $('#alter-table-drop').css('display', 'none');
                }

                buildTable(function () {
                    $panel.show();
                    updateSQLDisplay();
                });
            });
        }
        else {

            $('#cap-tableName').val('');
            $('#cap-schemaName').val('');
            $('#cap-oldTableName').val('');
            $('#cap-oldSchemaName').val('');
            $('#alter-table-all-fields').val('');
            $('#alter-table-fdefault').val('');
            $('#alter-table-fcomment').val('');
            clearRowsFromTable($panel);
            addRowToTable($('#atable_th').get(0));
            $panel.show();
        }
    };

    function showCommentsColumn(el) {

        var show = ($(el).prop('checked')) ? "" : "none";
        $('input[id^="alter-table-fcomment_"]').parent().css('display', show);
        $('th[id^="alter-table-fcomment"]').css('display', show);
    }

    function showDefaultsColumn(el) {

        var show = ($(el).prop('checked')) ? "" : "none";
        $('input[id^="alter-table-fdefault_"]').parent().css('display', show);
        $('th[id^="alter-table-fdefault"]').css('display', show);
    }

    function addRowToTable(domel) {

        var $table = $('#' + tableId);
        // find row id
        var newrowIdx = parseInt(maxRowId, 10) + 1;
        // var $row = $('#atable_th').next().clone().show();
        var $row = $('*[id^="atable_tr"]').first().clone().show();
        var rowID = $(domel).closest('tr').attr('id');
        if (rowID === 'atable_th') { // if add button in header clicked
            rowID = $('#' + tableId + ' tbody tr:last').attr('id');
        }
        // function to add row# to end of id values
        var reg = /(\S+)_(\d*)$/;

        function update_id_unique($el, i) {
            var id = $el.attr('id');
            if (id && id.length && reg.test(id)) { //substr(id.length-1)==='_')
                id = id.replace(reg, '$1_' + i);
                $el.attr('id', id);
            }
        }

        // update all *_ ids with iteration number *_#
        $row.attr('id', 'atable_tr_' + newrowIdx);
        $row.find('td')
            .add('select', $row)
            .add('input', $row)
            .each(function () {
                update_id_unique($(this), newrowIdx);
            });

        // remove prior values
        $row.find('select', $row)
            .add('input', $row)
            .each(function () {
                $(this).val('');
            });

        // attach new row
        maxRowId = maxRowId + 1;

        // remove 'keep same' option
        var $nratf = $row.find('*[id^="alter-table-ftype_"]');
        if ($nratf && $nratf.length && $nratf.val() === KEEPSAMEVALUE) {
            $nratf.find('option:first').remove();
        }

        $('#' + rowID).after($row);
        $table.find('*:input:first').change();
    }

    function delRowFromTable(domel) {

        var $table = $('#' + tableId);

        // if this is last row - don't delete
        if ($table.find('tbody tr').length === 1) {
            alert('Table must have at least one row!');
            return false;
        }

        // remove html
        var rowID = $(domel).parents().get(1).id;
        $table.find('#' + rowID).remove();
        $table.find('*:input:first').change();
        return false;
    }

    function clearRowsFromTable($panel) {

        var $table = $('#' + tableId, $panel),
            $lastRow, rowID;

        // if this is last row - don't delete
        var rowct = $table.find('tbody tr').length;
        while (rowct > 2) {
            $lastRow = $table.find('tbody tr:last');
            rowID = $lastRow.closest('tr').attr('id');
            $table.find('#' + rowID).remove();
            rowct = $table.find('tbody tr').length;
        }

        $lastRow = $table.find('tbody tr:last');
        $lastRow.css('display', 'none');
    }

    function onChange(domel) {

        var $row = $(domel).closest('tr');
        var $typeSelect = $row.find('td:eq(1) select');

        // if selected elem is in row...
        if ($typeSelect.length) {
            var idre = /^alter-table-ftype_(\d+)$/;
            var tmpId = $typeSelect.attr('id');
            var id = idre.exec(tmpId)[1];
            // make size visible or not, depending on type
            var lenvis = takes_length($typeSelect.val()) ? 'visible' : 'hidden';
            $row.find('#alter-table-flength_' + id).css('visibility', lenvis);
        }

        updateSQLDisplay();
    }

    function updateSQLDisplay() {

        var queryObj = getQueryString();
        var $panel = $('#' + that.panelId);

        if (queryObj.query === '') {

            $('#alter-table-sql-show').html('-- nothing to show');
            $('.edit-sql-btn', $panel).addClass('disabledBtn')
                .attr('disabled', 'disabled');
        }
        else {

            $('#alter-table-sql-show').html(queryObj.query);
            $('.edit-sql-btn', $panel).removeClass('disabledBtn')
                .removeAttr('disabled');
        }

        if ((!queryObj.query) || queryObj.status === 'edit-needed') {

            $('#alter-table-save', $panel).addClass('disabledBtn')
                .attr('disabled', 'disabled');
            $('.lookup-create-link', $panel).addClass('disabledLink');
        }
        else {

            $('#alter-table-save', $panel).removeClass('disabledBtn')
                .removeAttr('disabled');
            $('.lookup-create-link', $panel).removeClass('disabledLink');
        }
    }

    function getQueryString() {

        var sql;
        if (mode === 'alter') {
            sql = createAlterQueryString();
        }
        else {
            sql = createCreateQueryString();
        }
        return sql;
    }

    function buildTable(callLast) {

        // function to add row# to end of id values
        function make_id_unique($el, i) {

            var id = $el.attr('id');
            if (id && id.length && id.substr(id.length - 1) === '_') {
                $el.attr('id', id + i);
            }
        }

        if (!callLast) {
            callLast = function () {
            };
        }

        var $table = $('#' + tableId);

        function build(columnComments, tableComment, schemaName, tableName) {

            // runs for every table, 'create' and 'alter'
            var $hdr = $table.find('tr:first').clone(true);
            var $colrow = $table.find('tr[id^="atable_tr"]:first').show();
            $table.empty().append($hdr);
            $table.append($colrow.clone().hide());

            //<tr id="atable_th"><th>Column Name</th><th>Type</th><th>Length</th>
            //<th>Options</th><th>NULL</th><th style="display: none;" id="alter_table_fdefault">Default</th>
            //<th style="display: none;" id="alter_table_fcomment">Comment</th>
            //<th><input type="image" title="Add next" src="css/plus.gif" id="alter_table_add_row"/></th>

            var tCols = tableMeta.getColumns();
            for (var i = 0; i < tCols.length; i += 1) {

                var col = tCols[i];
                if (col.maxLength === null) {
                    col.maxLength = '';
                }
                var $newRow = $colrow.clone().show();

                // put various values in the new row
                $newRow.find('#alter-table-fpos_').val(col.pos);
                $newRow.find('#alter-table-fname_')
                    .add('#alter-table-foldname_', $newRow)
                    .val(col.columnName);
                $newRow.find('#alter-table-flength_')
                    .add('#alter-table-foldlength_', $newRow).val(col.maxLength);
                $newRow.find('#alter-table-fdefault_')
                    .add('#alter-table-folddefault_', $newRow)
                    .val(col.columnDefault === null ? '' : col.columnDefault);
                $newRow.find('#alter-table-fcomment_')
                    .add('#alter-table-foldcomment_', $newRow)
                    .val(columnComments[i] === null ? '' : columnComments[i]);

                // set checkbox status according to field state - null/not null
                if (col.isNullable) {
                    $newRow.find('#alter-table-fisnull_').prop('checked', true);
                    $newRow.find('#alter-table-foldisnull_').val(1)
                }

                // set checkbox status according to field state - array
                if (parseInt(col.numDims, 10) > 0) {
                    $newRow.find('#alter-table-farray_').prop('checked', true);
                    $newRow.find('#alter-table-foldarray_').val(1);
                }

                // if mode is create - delete 'keep same' option
                if (mode !== 'alter') {
                    var $ftopts = $newRow.find('#alter-table-ftype_ option');
                    $($ftopts.get(0)).remove();
                }

                // set field type in select input
                // if there's no such type - select ** keep same ** option
                var $typefnd = $newRow.find('#alter-table-ftype_ option').filter(function () {
                    return ($(this).val() === col.dataType);
                });

                if ($typefnd.length) {
                    $newRow.find('#alter-table-foldtype_')
                        .add('#alter-table-ftype_', $newRow)
                        .val(col.dataType);
                }
                else { // is_customType
                    $newRow.find('#alter-table-foldtype_')
                        .add('#alter-table-ftype_', $newRow)
                        .val(KEEPSAMEVALUE);
                }

                // update all *_ ids with iteration number *_#
                $newRow.find('td')
                    .add('select', $newRow)
                    .add('input', $newRow)
                    .each(function () {
                        make_id_unique($(this), i);
                    });

                make_id_unique($newRow, i);
                $table.append($newRow);
                maxRowId = i;
            }

            // save comments
            $('#atable-column-comments').prop('checked', false);
            $('#atable-column-defaults').prop('checked', false);
            $('#cap-tableName').add('#cap-oldTableName').val(tableName);
            $('#cap-schemaName').add('#cap-oldSchemaName').val(schemaName);
            $('#alter-table-comment').add('#alter-table-oldcomment')
                .val(tableComment ? tableComment : '');
            $table.find('*:input:first').change();
        }

        function buildAlterTable() {

            function withDetails(sT) {

                function withOID(table_oid) {

                    var tableCmt = false,
                        columnCmts = false,
                        tableName = tableMeta.getTableNameOnly(),
                        schemaName = tableMeta.getSchemaNameOnly();

                    function buildWhenReady() {

                        if (tableCmt !== false && columnCmts !== false) {
                            // pass column and table comments to build
                            build(columnCmts, tableCmt, schemaName, tableName);
                            callLast();
                        }
                    }

                    function withColComments(colcmts) {

                        columnCmts = colcmts || [];
                        buildWhenReady();
                    }

                    function withTableComments(tabcmt) {

                        tableCmt = tabcmt || '';
                        buildWhenReady();
                    }

                    databaseManager.getColumnComments(table_oid, tableMeta.getColumns(),
                        withColComments, logErrors);
                    databaseManager.getTableComment(table_oid, withTableComments);
                }

                tableMeta = sT;
                databaseManager.getTableOID(tableMeta.getSchemaNameOnly(),
                    tableMeta.getTableNameOnly(), withOID);
            }

            databaseManager.getTableDetails(tableMeta.getSchemaNameOnly(),
                tableMeta.getTableNameOnly(), withDetails);
        }

        function buildCreateTable() {

            tableMeta = new ResourceMeta();
            tableMeta.addColumn(new SQLColumn());
            build([], '', '', '');
        }

        // get table details
        if (mode === 'alter') {
            buildAlterTable();
        }
        else {
            buildCreateTable();
        }
    }

    function dropTable() {

        if (!confirm('Are you sure?')) {
            return false;
        }

        function dropcb() {
            var sch = tableMeta.getSchemaNameOnly();
            tableMeta.nameResource(sch, '');
            rdbAdmin.updateTableList();
            rdbAdmin.loadNewPage('#/');
        }

        databaseManager.dropTable(tableMeta.quotedResourceName(), dropcb);
        return true;
    }

    function createCreateQueryString() {

        var $panel = $('#' + that.panelId),
            queryParts = [],
            status = 'ok',
            isInput = false;

        function queryStart(tMeta) {
            return 'CREATE TABLE ' + tMeta.quotedResourceName() + ' (';
        }

        function tableComment(tMeta, tableCmt) {
            return 'COMMENT ON TABLE ' + tMeta.quotedResourceName() + " IS '" + tableCmt + "';";
        }

        function columnComment(tMeta, columnName, colComment) {
            return 'COMMENT ON COLUMN ' + tMeta.quotedResourceName() + '.' +
                quoteIdentifier(columnName) + " IS '" + colComment + "';";
        }

        function queryColumn(fname, ftype, flen, farray, fnull, fdefault) {

            var colParts = ['   '];
            colParts.push(quoteIdentifier(fname));
            var typ = ftype;
            if (flen) {
                typ += '(' + flen + ')';
            }
            if (farray) {
                typ += '[]';
            }
            colParts.push(typ);
            if (fdefault) {
                colParts.push("DEFAULT '~~'".replace('~~', fdefault));
            }
            colParts.push(fnull ? 'NULL' : 'NOT NULL');
            return colParts.join(' ');
        }

        // retrieve elements from form, add to query parts list
        var tableName = $panel.find('#cap-tableName').val(),
            schemaName = $panel.find('#cap-schemaName').val();
        if (!tableName) {
            tableName = '~tablename~';
            status = 'edit-needed';
        }

        var tMeta = new ResourceMeta();
        tMeta.nameResource(schemaName, tableName);
        queryParts.push(queryStart(tMeta));

        var queryColumns = [],
            colComments = [];

        $panel.find('tbody tr:visible').each(function (idx) {

            var $trow = $(this);
            if ($trow.attr('id') === 'atable_th') {
                return true; // skip header row
            }
            var fname = $trow.find('input[id^="alter-table-fname_"]').val();
            var ftype = $trow.find('*[id^="alter-table-ftype_"]').val();
            var flen = $trow.find('*[id^="alter-table-flength_"]:visible').val();
            var farray = $trow.find('*[id^="alter-table-farray_"]:checked').length;
            var fnull = $trow.find('*[id^="alter-table-fisnull_"]:checked').length;
            var fdefault = $trow.find('*[id^="alter-table-fdefault_"]').val();
            var fcomment = $trow.find('*[id^="alter-table-fcomment_"]').val();

            if (!fname) {
                status = 'edit-needed';
                fname = '~col+~'.replace('+', idx);
            }
            else {
                isInput = true;
            }

            queryColumns.push(queryColumn(fname, ftype, flen, farray, fnull, fdefault));
            if (fcomment) {
                colComments.push([tMeta, fname, fcomment]);
            }

            return true;
        });

        queryParts.push(queryColumns.join(',\n'));
        queryParts.push(');'); // close statement

        var tableCmt = $panel.find('#alter-table-comment').val(),
            oldTableCmt = $panel.find('#alter-table-oldcomment').val();
        if (tableCmt !== oldTableCmt) {
            queryParts.push(tableComment(tMeta, tableCmt));
        }

        for (var ccn in colComments) {

            if (colComments.hasOwnProperty(ccn)) {

                var cc = colComments[ccn];
                var tmeta = cc[0], cname = cc[1], cmt = cc[2];
                queryParts.push(columnComment(tmeta, cname, cmt));
            }
        }

        var q = isInput ? queryParts.join('\n') : '';
        return { 'status':status,
            'query':q };
    }

    function createAlterQueryString() {

        var $panel = $('#' + that.panelId),
            tableName = $panel.find('#cap-tableName').val(),
            schemaName = $panel.find('#cap-schemaName').val(),
            queryParts = [];

        var newTableMeta = new ResourceMeta();
        newTableMeta.nameResource(schemaName, tableName);

        function tableRename(oldMeta) {
            return 'ALTER TABLE ' + oldMeta.quotedResourceName() +
                ' RENAME TO ' + newTableMeta.quotedTableNameOnly();
        }

        function schemaRename(oldMeta) {
            return 'ALTER TABLE ' + oldMeta.quotedResourceName() +
                ' SET SCHEMA ' + newTableMeta.quotedSchemaNameOnly();
        }

        function columnRename(oldColName, colName) {
            return 'ALTER TABLE ' + newTableMeta.quotedResourceName() +
                ' RENAME ' + quoteIdentifier(oldColName) +
                ' TO ' + quoteIdentifier(colName);
        }

        function newColumn(fname, ftype, flen, farray, fnull, fdefault) {

            var colParts = ['   ADD COLUMN'];
            colParts.push(quoteIdentifier(fname));
            var typ = ftype;
            if (flen) {
                typ += '(' + flen + ')';
            }
            if (farray) {
                typ += '[]';
            }
            colParts.push(typ);
            if (fdefault) {
                colParts.push("DEFAULT '~~'".replace('~~', fdefault));
            }
            colParts.push(fnull ? 'NULL' : 'NOT NULL');
            return colParts.join(' ');
        }

        function queryStart(tableMeta) {

            return 'ALTER TABLE ' + tableMeta.quotedResourceName();
        }

        function tableComment(tableMeta, tableCmt) {

            return "COMMENT ON TABLE ~tn~ IS '~tc~'"
                .replace('~tn~', tableMeta.quotedResourceName())
                .replace('~tc~', tableCmt);
        }

        function columnComment(tableMeta, columnName, colComment) {

            return "COMMENT ON COLUMN ~tn~.~cn~ IS '~tc~'"
                .replace('~tn~', tableMeta.quotedResourceName())
                .replace('~cn~', quoteIdentifier(columnName))
                .replace('~tc~', colComment);
        }

        function alterColumnType(fname, ftype, flen, farray) {

            var colParts = ['   ALTER COLUMN'];
            colParts.push(quoteIdentifier(fname));
            colParts.push('TYPE');
            var typ = ftype;
            if (flen) {
                typ += '(' + flen + ')';
            }
            if (farray) {
                typ += '[]';
            }
            colParts.push(typ);
            return colParts.join(' ');
        }

        function alterColumnNull(fname, fnull) {

            var colParts = ['   ALTER'];
            colParts.push(quoteIdentifier(fname));
            colParts.push(fnull ? 'DROP' : 'SET');
            colParts.push('NOT NULL');
            return colParts.join(' ');
        }

        function alterColumnDefault(fname, fdefault) {

            var colParts = ['   ALTER'];
            colParts.push(quoteIdentifier(fname));
            colParts.push(fdefault
                ? "SET DEFAULT '~d~'".replace('~d~', fdefault.replace("'", "\\'"))
                : 'DROP DEFAULT');
            return colParts.join(' ');
        }

        function dropColumn(fname) {

            var colParts = ['   DROP COLUMN'];
            colParts.push(quoteIdentifier(fname));
            return colParts.join(' ');
        }

        // retrieve old tablename from form, if name changed, add
        //  a rename to the queryParts list
        var oldTableName = $panel.find('#cap-oldTableName').val(),
            oldSchemaName = $panel.find('#cap-oldSchemaName').val(),
            oldMeta = new ResourceMeta();

        oldMeta.nameResource(oldSchemaName, oldTableName);
        if (oldMeta.getSchemaNameOnly() !== newTableMeta.getSchemaNameOnly()) {
            queryParts.push(schemaRename(oldMeta));
            var midMeta = new ResourceMeta();
            midMeta.nameResource(newTableMeta.getSchemaNameOnly(), oldMeta.getTableNameOnly());
            oldMeta = midMeta;
        }

        if (oldMeta.getTableNameOnly() !== newTableMeta.getTableNameOnly()) {
            queryParts.push(tableRename(oldMeta));
        }

        var colRenames = [],
            colComments = [], // tuples of (fieldname, columncomment)
            knownfields = [], // list of fields now in db
            alterQueryParts = [];

        // iterate over rows of html table, and process each
        //  field/row
        $panel.find('tbody tr:visible').each(function () {

            var $trow = $(this);
            if ($trow.attr('id') === 'atable_th') {
                return true; // skip header row
            }

            // get old and new column names. if different, put a rename
            //   sql clip on colRenames list
            var fname = $trow.find('input[id^="alter-table-fname_"]').val(),
                foldname = $trow.find('input[id^="alter-table-foldname_"]').val();
            knownfields.push(foldname);
            if (foldname && (foldname !== fname)) {
                colRenames.push(columnRename(foldname, fname));
            }

            // get old and new types. if different put a col change action on
            //  alterQueryParts.
            var ftype = $trow.find('*[id^="alter-table-ftype_"]').val(),
                foldtype = $trow.find('*[id^="alter-table-foldtype_"]').val(),

                $flen = $trow.find('*[id^="alter-table-flength_"]'),
                flen = ($flen && $flen.css('visibility') === 'visible') ? $flen.val() : '',
                foldlen = $trow.find('*[id^="alter-table-foldlength_"]').val(),

                farray = $trow.find('*[id^="alter-table-farray_"]:checked').length || 0,
                foldarray = $trow.find('*[id^="alter-table-foldarray_"][value="1"]').length || 0,

                newForm = alterColumnType(fname, ftype, flen, farray),
                // use new name for both
                oldForm = alterColumnType(fname, foldtype, foldlen, foldarray);

            if (foldname && (newForm !== oldForm)) {
                alterQueryParts.push(newForm);
            }

            // get old and new null status. if changed, add a col change action
            //  on alterQueryParts
            var fnull = $trow.find('*[id^="alter-table-fisnull_"]:checked').length,
                foldnull = $trow.find('*[id^="alter-table-foldisnull_"][value="1"]').length;
            if (foldname && (fnull !== foldnull)) {
                alterQueryParts.push(alterColumnNull(fname, fnull));
            }

            // get old and new default values. if changed, add a col change action
            //   to alterQueryParts
            var fdefault = $trow.find('*[id^="alter-table-fdefault_"]').val(),
                folddefault = $trow.find('*[id^="alter-table-folddefault_"]').val();
            if (foldname && (fdefault !== folddefault)) {
                alterQueryParts.push(alterColumnDefault(fname, fdefault));
            }

            // get old and new column comments. add col change action if necessary
            var fcomment = $trow.find('*[id^="alter-table-fcomment_"]').val(),
                foldcomment = $trow.find('*[id^="alter-table-foldcomment_"]').val();
            if (fcomment !== foldcomment) {
                colComments.push(columnComment(newTableMeta, fname, fcomment));
            }

            // handle new field
            if (!foldname) {
                alterQueryParts.push(newColumn(fname, ftype, flen, farray, fnull, fdefault));
            }
            return true;
        });

        // compare orig field list with knownfields, and drop un-kept fields
        var _cols = tableMeta.getColumns();
        for (var c in _cols) {

            var ofname = _cols[c].columnName;
            if ($.inArray(ofname, knownfields) === -1) {
                alterQueryParts.push(dropColumn(ofname));
            }
        }

        // assemble various lists into one big query
        if (alterQueryParts.length) {

            var aq = [ queryStart(newTableMeta),
                alterQueryParts.join(',\n') ];
            queryParts.push(aq.join('\n'));
        }

        queryParts = queryParts.concat(colComments);

        // if table comment change, add sql segment
        var tablecmt = $panel.find('#alter-table-comment').val(),
            oldtablecmt = $panel.find('#alter-table-oldcomment').val();

        if (tablecmt !== oldtablecmt) {
            queryParts.push(tableComment(newTableMeta, tablecmt));
        }
        if (colRenames.length) {
            queryParts.unshift(colRenames.join(';\n'));
        }
        if (queryParts.length) {
            queryParts.push(''); // force trailing ';'
        }
        var q = queryParts.join(';\n');
        return {
            'status':'ok',
            'query':q
        };
    }

    function saveTable() {

        var $panel = $('#' + that.panelId),
            tableName = $panel.find('#cap-tableName').val(),
            schemaName = $panel.find('#cap-schemaName').val(),
            newMeta = new ResourceMeta();
            newMeta.nameResource(schemaName,tableName);

        function successcb() {
            rdbAdmin.updateTableList();
            rdbAdmin.loadNewPage('#/table/' + newMeta.qualResourceName());
        }

        var sqlObj = getQueryString();
        if (!sqlObj.query) {
            alert('nothing to do!');
            return false;
        }

        // send query to engine, feed results to callback
        databaseManager.sqlEngine.query({
            'q':sqlObj.query,
            'callback':successcb,
            'errback':errback
        });
        return false;
    }

}
