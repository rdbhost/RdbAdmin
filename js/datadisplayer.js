/* -- */


function DataDisplayer(rdbAdmin)
{

    var entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;'
    };

    var this_ = this,
        $headerRow, $headerCheckboxItem, $headerCell, $bodyRow, $bodyCheckboxItem, $bodyCell;

    this.dataWasTruncated = undefined;

    function escapeHtml(str) {
        return String(str).replace(/[&<>"'\/]/g, function (s) {
            return entityMap[s];
        });
    }

    function escapeLenLimit(str, lim) {
        if (lim === undefined)
            return escapeHtml(str);

        if (lim < 200)
            lim = 500;

        if (str.length > lim){

            this_.dataWasTruncated = true;
            return escapeHtml(str.substr(0, 250)) + '<span class=null-data>.....................</span>'
                + escapeHtml(str.substr(str.length-150));
        }
        return escapeHtml(str)
    }


    function reformat(cellData, noTruncate) {

        var $cell, tmpArray, $t;
        if (cellData === null) {
            $cell = $('<span class="null-data"></span>');
            $cell.text('null');

            return $cell;
        }
        else if ($.isArray(cellData)) {

            if (cellData.length) {

                tmpArray = [$('<span class=null-data>{</span>')];
                for (var cD in cellData) {

                    tmpArray.push(reformat(cellData[cD], noTruncate));
                    tmpArray.push($('<span class=null-data>, </span>'));
                }
                tmpArray.push($('<span class=null-data>}</span>'));

                $t = $('<div>');
                while (tmpArray.length)
                    $t.append(tmpArray.shift());
                return $t.html();
            }

            else {
                return $('<span class=null-data>{}</span>');
            }
        }
        else {
            var lim = noTruncate ? Math.pow(10,10) : 500;
            return escapeLenLimit(cellData, lim);
        }
    }

    // function to handle error result of query submit
    function errback(err) {
        rdbAdmin.showErrorMessage('<pre>' + err[0] + ':' + err[1] + '</pre>');
    }

    this.init_handlers = function (app) {
        /* import html elements from DOM for table generation
         */
        var $table = $('#reference-data-table');
        $headerRow = $('thead tr', $table);
        $headerCheckboxItem = $('th:first', $headerRow).remove();
        $headerCell = $('th:first', $headerRow).remove();
        $bodyRow = $('tbody tr', $table);
        $bodyCheckboxItem = $('td:first', $bodyRow).remove();
        $bodyCell = $('td:first', $bodyRow).remove();
    };

    this.show = function (tableId, header, rows, isEditable, fullRecs) {
        /*
         @param tableId: id of div to put table into
         @param header:
         @param rows: list of arrays, one per db row
         @param isEditable: can records be edited (do records have unique keys)
         @fullRecs: can records not be abbreviated for display space conservation

         @returns undefined:
         */

        var $table = $('#' + tableId),
            $tr, $cell;

        // reset truncation flag, maybe set by reformat
        this.dataWasTruncated = false;

        // empty the table
        $table.empty();

        if (header) {

            // create header of html table
            //
            $tr = $headerRow.clone();
            if (isEditable || header.length === 0) {
                $tr.append($headerCheckboxItem.clone());
            }

            for (var i in header) {

                // add html column headers
                $cell = $headerCell.clone();
                $('span', $cell).text(header[i][1]);

                // todo - add special formats to headers
                $tr.append($cell);
            }
            $tr.appendTo($table);

            // render data as rows
            //
            if (rows && rows.length) {

                for (i in rows) {

                    var row = rows[i];

                    $tr = $bodyRow.clone();
                    if (isEditable) {
                        $tr.append($bodyCheckboxItem.clone());
                    }

                    for (var j in row) {

                        $cell = $bodyCell.clone();
                        $cell.html(reformat(row[j], fullRecs));
                        $tr.append($cell);
                    }

                    $tr.appendTo($table);
                }
            }
            else {
                // show a null-message row
                //
                $tr = $bodyRow.clone();
                $cell = $bodyCell.clone();
                var colCt = header.length;
                if (isEditable)
                    colCt = colCt + 1;

                $cell.attr('colspan', colCt);
                $cell.text('there is no data to display.');
                $tr.append($cell);
                $tr.appendTo($table);
            }
        }
    }
}


//