/*

 SqlPanel object provides handlers for the SQL Command page.
 call init_handlers from main.html, after creating the object.

 */

function SqlPanel(rdbAdmin, sqlEngine, dataDisplayer) {

    if (!rdbAdmin) {
        alert('bad rdbAdmin');
    }
    this.panelId = 'sql-panel';
    var sqlResults = [],
        formId = 'sql-panel-form',
        queryHandoff = undefined,
        $entryField = undefined,
        $tableSource = undefined,
        that = this;

    // function to handle error result of query submit
    //
    function errback(err) {

        rdbAdmin.onStopQueryExecution();
        var err2;
        if (typeof(err) === 'object') {
            err2 = Array.apply(null, err2);
        }
        var arg2 = Array.apply(null, arguments);
        rdbAdmin.showErrorMessage('<pre>' + arg2.join(', ') + '</pre>');
    }

    this.init_handlers = function () {

        $entryField = $('#query-text-area');
        $('#sqlcommand').click(function () {
            rdbAdmin.loadNewPage('#/sqlcommand');
        });

        var $form = $('#' + formId);
        $tableSource = $('#sql-panel-result-table', $form).remove();
        $form.find('#query-execute-button').click(function (ev) {
            console.log('query-execute-button clicked');
            ev.stopImmediatePropagation();
            rdbAdmin.resetMessages();
            that.executeQuery();
        });

        $form.find('table table button').click(function (ev) {
            ev.stopPropagation();
            $(this).parent().children(':input').toggle();
        });

        $form.find('#add-pos-arg').click(function (ev) {
            ev.stopPropagation();
            $form.find('.posArg:hidden').first().show();
            if ($form.find('.posArg:hidden').length === 0)
                $form.find('#add-pos-arg').attr('disabled', 'disabled');
            return false;
        });

        $form.find('#add-named-arg').click(function (ev) {
            ev.stopPropagation();
            $form.find('.namedArg:hidden').first().show();
            if ($form.find('.namedArg:hidden').length === 0)
                $form.find('#add-named-arg').attr('disabled', 'disabled');
            return false;
        });

        $entryField.change(function (ev) {

            ev.stopPropagation();
            var fldQuery = $entryField.val();
            if (fldQuery)
                jQuery.cookie('sql', fldQuery);
        });

        // redo results display when full-values checkbox gets toggles
        $('#sql-full-values', $form).change(function (ev) {
            that.fillResultsTable();
            ev.stopPropagation();
        });
    };

    this.showQuery = function (query) {

        rdbAdmin.resetMessages();
        var $form = $('#' + formId),
            $that;

        if (!rdbAdmin.isLoggedIn()) {
            alert('You must login first!');
            return false;
        }
        this.clearPanel();
        $('#sql-full-value-checkbox').hide();
        rdbAdmin.setHeading("Perform SQL Query");

        $form.find('table :input').each(function () {
            var typ = $(this).attr('type'),
                lbl;

            if (typ === 'file') {
                $(this).hide();
            }
            else if (typ === 'text') {
                $(this).show();
            }
            else if (typ === 'button') {
                $that = $(this);
                lbl = $that.html();
                $that.removeAttr('name'); // TODO remove
                if (lbl === 'file') {
                    $that.show();
                }
                else {
                    $that.hide();
                }
            }
        });

        if (query) {
            $entryField.val(query);
        } else if (queryHandoff) {
            $entryField.val(queryHandoff.query.replace(/%/g, '%%'));
            queryHandoff = undefined;
        }
        $entryField.change();

        this.reshow(query);
        return true;
    };

    this.reshow = function (query) {

        var that = this;

        function queryCallback(data) {

            var _rs, rs,
                workingMessage = [];
            rdbAdmin.onStopQueryExecution();
            sqlResults = [];

            if (data.status[0] !== 'error') {

                if (data.result_sets) {

                    for (_rs in data.result_sets) {

                        rs = data.result_sets[_rs];
                        workingMessage.push(rs.row_count[1]);

                        if ('records' in rs) {
                            sqlResults.push(rs);
                        }
                    }
                }
                else if (data.records) {

                    sqlResults.push(data);
                    workingMessage.push(data.row_count[1]);
                }
                else {

                    workingMessage.push(data.row_count[1]);
                }

                if (sqlResults.length) {

                    that.fillResultsTable();
                    $panel = $('#sql-panel');
                    $panel.find("#query-results-div").show();
                }
                rdbAdmin.showWorkingMessage(workingMessage.join('<br>\n'));

                rdbAdmin.updateSidePanel('tvsf');
            }

            else {
                alert('error wrongly passed to success callback ' + data.error[1]);
            }
        }

        sqlEngine.queryByForm({
            'formId': formId,
            'callback': function (resp) {
                that.reshow(query);
                queryCallback(resp);
            },
            errback: function (err) {
                that.reshow(query);
                errback(err);
            }
        });
    };

    this.showQueryLater = function (query) {
        queryHandoff = query;
    };

    this.clearPanel = function () {
        $("#query-results-div").empty().hide();
    };

    this.executeQuery = function () {

        var $panel = $('#sql-panel'),
            $qta = $panel.find('#query-text-area'),
            query;
        $panel.find('#query-results-div').empty();
        query = $qta.val();

        // prep arg### fields
        $panel.find(':input[id^=arg0]:visible').each(function () {
            var $argid = $(this).attr('id');
            $(this).attr('name', $argid.substr(0, 6));
        });

        // prep arg:### fields
        $panel.find(':input[id^=parm0]:visible').each(function () {
            var $argid = $(this).attr('id');
            var argNameKey = 'parmName' + $argid.substr(4, 3);
            var argName = $panel.find('#' + argNameKey).val();
            $(this).attr('name', 'arg:' + argName);
        });

        // functions to handle results of query submit
        function errback(err) {
            rdbAdmin.onStopQueryExecution();
            rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
        }

        // querying
        rdbAdmin.onStartQueryExecution();
        rdbAdmin.resetMessages();
    };

    this.fillResultsTable = function () {

        var $resultsDiv = $("#query-results-div"),
            $table;

        if (sqlResults.length) {

            $resultsDiv.empty();
            for (var _r in sqlResults) {

                var r = sqlResults[_r],
                    noTruncate = $('#sql-full-values').is(':checked');

                $table = $tableSource.clone();
                $table.attr('id', 'sql-panel-result-table' + _r);

                $resultsDiv.append($table);
                dataDisplayer.show('sql-panel-result-table' + _r, r.records.header, r.records.rows, false, noTruncate);
            }

            if (dataDisplayer.dataWasTruncated || noTruncate)
                $('#sql-full-value-checkbox').show();
            else
                $('#sql-full-value-checkbox').hide();

            $resultsDiv.show();
        }
    };
}
