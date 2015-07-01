/*
 This module provides code to display table (and assoc index) structures

 */

function TablePanel(rdbAdmin, dbMgr) {

    this.panelId = 'table-panel';
    this.sqlTable = null;
    this.tableIdentifier = null;
    this.indexes = null;
    this.constraints = null;
    this.triggers = null;
    var that = this;

    // function to handle error result of query submit
    function errback(err) {
        //alert(err.toString());
        rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
    }

    this.init_handlers = function (app) {

        $('#alter-table-btn').click(function (ev) {
            app.setLocation('#/altertable/' + encodeURIComponent(that.tableIdentifier));
            ev.stopPropagation();
        });
        $('#alter-constraint-btn').click(function (ev) {
            app.setLocation('#/alterconstraint/' + encodeURIComponent(that.tableIdentifier));
            ev.stopPropagation();
        });
        $('#alter-index-btn').click(function (ev) {
            app.setLocation('#/alterindex/' + encodeURIComponent(that.tableIdentifier));
            ev.stopPropagation();
        });
        $('#alter-trigger-btn').click(function (ev) {
            app.setLocation('#/altertrigger/' + encodeURIComponent(that.tableIdentifier));
            ev.stopPropagation();
        });
    };


    this.show = function (tableName) {

        this.tableIdentifier = tableName;
        var $panel = $('#' + this.panelId);
        $panel.hide();
        rdbAdmin.onStartQueryExecution();

        var oaf = new OnAllFinish(['table', 'index', 'constraint', 'trigger'], function () {
            rdbAdmin.onStopQueryExecution();
            $panel.show();
        });
        this.buildDetailsTable(function () {
            oaf.finished('table');
        });
        this.buildIndexesTable(function () {
            oaf.finished('index')
        });
        this.buildConstraintsTable(function () {
            oaf.finished('constraint')
        });
        this.buildTriggersTable(function () {
            oaf.finished('trigger');
        });
        rdbAdmin.setHeading("Table: " + tableName);
    };


    this.buildDetailsTable = function (finalcb) {

        // <th>Column Name</th><th>Type</th><th>Default</th>
        // <th>Is null</th><th>Length</th><th>Precision</th>
        var $table = $('#column-details-table'),
            $hdr = $table.find('tr:first'),
            $colrow = $table.find('.column-details-row:first')
                .css('display', 'table-row'),
            details = '', tableComments = '', columnComments = '';
        $table.empty().append($hdr);
        $table.append($colrow.clone().hide());

        var oaf = new OnAllFinish(['dtls', 'tblcmts', 'colcmts'], function () {

            that.sqlTable = details;
            var columns = details.getColumns();
            for (var i in columns) {

                if (columns.hasOwnProperty(i)) {

                    var col = columns[i];
                    var dataType = (parseInt(col.numDims, 10) === 0)
                        ? col.dataType
                        : col.dataType + '[]';
                    var row = $colrow.clone();

                    row.find('th:first').html(col.columnName)
                        .next().html(dataType)
                        .next().html(col.columnDefault)
                        .next().html(col.isNullable ? 'Null' : '')
                        .next().html(col.sizeString())
                        .next().html(columnComments[i] === null ? '' : columnComments[i]);
                    $table.append(row);
                }

                finalcb();
            }
        });

        function successCB(tbl_dtls) {

            details = tbl_dtls;
            oaf.finished('dtls');

            if (details.tableOID) {

                dbMgr.getTableComment(details.tableOID, function (tc) {
                    tableComments = tc;
                    oaf.finished('tblcmts');
                });
                dbMgr.getColumnComments(details.tableOID, details.getColumns(), function (cc) {
                    columnComments = cc;
                    oaf.finished('colcmts');
                });
            }
            else {
                oaf.finished('tblcmts');
                oaf.finished('colcmts');
            }
        }

        var table = new ResourceMeta(this.tableIdentifier);
        dbMgr.getTableDetails(table.getSchemaNameOnly(), table.getTableNameOnly(), successCB, errback);
    };

    this.buildIndexesTable = function (finalcb) {

        // <th>Name</th><th>Primary</th><th>Unique</th><th>Definition</th>
        var $table = $('#index-details-table'),
            $hdr = $table.find('tr:first').show(),
            $idxrow = $table.find('.idx-details-row:first')
                .css('display', 'table-row');
        $table.empty().append($hdr);
        $table.append($idxrow.clone().hide());

        function successcb(indexes) {

            // var i;
            that.indexes = indexes;
            if (indexes.length === 0) {
                $table.find('tr').hide();
                $('#alter-index-btn').val('Add Index');
            }
            else {
                $('#alter-index-btn').val('Alter or Add Index');
            }

            for (var i = 0; i < indexes.length; i += 1) {
                var idx = indexes[i],
                    nm = idx[3], isPrimary = idx[2],
                    isUnique = idx[1], def = idx[5],
                    cmt = idx[7],
                    row = $idxrow.clone();
                row.find('th:first').html(nm)
                    .next().html(isPrimary ? 'Pri' : '')
                    .next().html(isUnique ? 'Uniq' : '')
                    .next().html(def)
                    .next().html(cmt);
                $table.append(row);
            }

            finalcb();
        }

        var tableMeta = new ResourceMeta(this.tableIdentifier);
        dbMgr.getIndexes(tableMeta.getSchemaNameOnly(), tableMeta.getTableNameOnly(), successcb, errback);
    };

    this.buildConstraintsTable = function (finalcb) {

        var $table = $('#constraint-details-table'),
            $hdr = $table.find('tr:first').show(),
            $conrow = $table.find('.constraint-details-row:first')
                .css('display', 'table-row');
        $table.empty().append($hdr);
        $table.append($conrow.clone().hide());
        // <th>Name</th><th>Primary</th><th>Unique</th><th>Definition</th>

        function successcb(constraints) {

            var i;
            that.constraints = constraints;
            if (constraints.length === 0) {
                $table.find('tr').hide();
                $('#alter-constraint-btn').val('Add Constraint');
            }
            else {
                $('#alter-constraint-btn').val('Alter or Add Constraint');
            }

            for (i = 0; i < constraints.length; i += 1) {
                var constraint = constraints[i],
                    $row = $conrow.clone();
                $row.find('th:first').html(constraint[0])
                    .next().html(constraint[12])
                    .next().html(constraint[15]);
                $table.append($row);
            }

            finalcb();
        }

        var tableMeta = new ResourceMeta(this.tableIdentifier);
        dbMgr.getConstraints(tableMeta.getSchemaNameOnly(), tableMeta.getTableNameOnly(), successcb, errback);
    };

    this.buildTriggersTable = function (finalcb) {

        var $table = $('#trigger-details-table'),
            $hdr = $table.find('tr:first').show(),
            $conrow = $table.find('.trigger-details-row:first')
                .css('display', 'table-row');

        $table.empty().append($hdr);
        $table.append($conrow.clone().hide());

        function successcb(triggers) {

            that.triggers = triggers;
            if (triggers.length === 0) {
                $table.find('tr').hide();
                $('#alter-trigger-btn').val('Add Trigger');
            }
            else {
                $('#alter-trigger-btn').val('Alter or Add Trigger');
            }
            // <tr><th>Name</th><th>Timing</th><th>Event</th><th>Foreach</th><th>Function</th></tr>
            for (var i = 0; i < triggers.length; i += 1) {

                var trigger = triggers[i],
                    $row = $conrow.clone();
                // TODO include schema in name
                $row.find('th:first').html(trigger[0])
                    .next().html(trigger[3])
                    .next().html(trigger[4])
                    .next().html(trigger[5])
                    .next().html(trigger[6])
                    .next().html(trigger[7]);
                $table.append($row);
            }

            finalcb();
        }

        var tableMeta = new ResourceMeta(this.tableIdentifier);
        dbMgr.getTriggers(tableMeta.getSchemaNameOnly(), tableMeta.getTableNameOnly(), successcb, errback);
    };

}

