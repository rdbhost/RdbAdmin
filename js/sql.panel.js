/*

 SqlPanel object provides handlers for the SQL Command page.
 call init_handlers from main.html, after creating the object.

 */

function SqlPanel(rdbAdmin, sqlEngine) {

    if (!rdbAdmin) {
        alert('bad rdbAdmin');
    }
    this.panelId = 'sql-panel';
    var sqlResults = [],
        formId = 'sql-panel-form',
        queryHandoff = undefined,
        receditPanel = undefined,
        $entryField = undefined,
        that = this;

    // function to handle error result of query submit
    function errback(err) {

        rdbAdmin.onStopQueryExecution();
        var err2;
        if (typeof(err) === 'object') {
            err2 = Array.apply(null, err2);
        }
        var arg2 = Array.apply(null, arguments);
        //alert(arg2.join(', '));
        rdbAdmin.showErrorMessage('<pre>' + arg2.join(', ') + '</pre>');
    }

    this.init_handlers = function (rePanel) {

        receditPanel = rePanel;
        $entryField = $('#query-text-area');
        $('#sqlcommand').click(function () {
            rdbAdmin.loadNewPage('#/sqlcommand');
        });

        var $form = $('#' + formId);
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
/*
            if ($(this).val() !== '') {
                $('.lookup-create-link', $form).removeClass('disabledLink');
            }
            else {
                $('.lookup-create-link', $form).addClass('disabledLink');
            }
*/
            var fldQuery = $entryField.val();
            if (fldQuery) {
                jQuery.cookie('sql', fldQuery);
            }
        });

/*
        $('.lookup-create-link', $form).click(function (ev) {

            ev.stopPropagation();
            var query = $entryField.val();
            if (!query) {
                alert('enter a query first!');
            }
            else {
                var fieldTransfer = { 'query': query };
                receditPanel.useRecordLater(fieldTransfer);
                rdbAdmin.loadNewPage('#/browser/insert/' + encodeURIComponent('lookup.queries'));
            }
        });
*/
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
            var argNameKey = 'parmName' + $argid.substr(4,3);
            var argName = $panel.find('#'+argNameKey).val();
            $(this).attr('name', 'arg:'+argName);
        });

        // functions to handle results of query submit
        function errback(err) {
            rdbAdmin.onStopQueryExecution();
            rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
        }

        // querying
        rdbAdmin.onStartQueryExecution();
        rdbAdmin.resetMessages();

        //return false;
    };

    this.fillResultsTable = function () {
        var $resultsDiv = $("#query-results-div"),
            $tabHeader, $tabBody, $tab, $cell;

        if (sqlResults.length) {

            for (var _r in sqlResults) {

                var r = sqlResults[_r];

                $tabHeader = $("<thead>");
                $tabBody = $("<tbody>");
                $tab = $('<table></table>');

                for (var i in r.records.header) {

                    var col = r.records.header[i][1];
                    $cell = $("<th>");
                    $cell.text(col);
                    $tabHeader.append($cell);
                }

                var $tabRow, row;
                for (i in r.records.rows) {

                    row = r.records.rows[i];
                    $tabRow = $("<tr>");

                    for (var j in row) {
                        if (row.hasOwnProperty(j)) {
                            $cell = $("<td>");
                            // todo - change this so arrays are handled better
                            $cell.append(document.createTextNode(row[j]));
                            $tabRow.append($cell);
                        }
                    }

                    $tabBody.append($tabRow);
                }

                $tab.append($tabHeader);
                $tab.append($tabBody);

                $resultsDiv.append($tab);
            }
        }
    };
}
