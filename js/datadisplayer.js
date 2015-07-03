/* -- */


function DataDisplayer(rdbAdmin)
{
    /* object to handle creation and renaming of views */

    var entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;'
    };

    function escapeHtml(string) {
        return String(string).replace(/[&<>"'\/]/g, function (s) {
            return entityMap[s];
        });
    }

    function reformat(cellData) {

        var $cell;
        if (cellData === null) {
            $cell = $('<span class="null-data"></span>');
            $cell.text('null');

            return $cell;
        }

        else {
            return escapeHtml(cellData);
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
        this.$headerRow = $('thead tr', $table);
        this.$headerCheckboxItem = $('th:first', this.$headerRow).remove();
        this.$headerCell = $('th:first', this.$headerRow).remove();
        this.$bodyRow = $('tbody tr', $table);
        this.$bodyCheckboxItem = $('td:first', this.$bodyRow).remove();
        this.$bodyCell = $('td:first', this.$bodyRow).remove();
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

        // empty the table
        $table.empty();

        if (header) {

            // create header of html table
            //
            $tr = this.$headerRow.clone();
            if (isEditable || header.length === 0) {
                $tr.append(this.$headerCheckboxItem.clone());
            }

            for (var i in header) {

                // add html column headers
                $cell = this.$headerCell.clone();
                $('span', $cell).text(header[i][1]);
                $tr.append($cell);
            }
            $tr.appendTo($table);

            // render data as rows
            //
            if (rows && rows.length) {

                for (i in rows) {

                    var row = rows[i];

                    $tr = this.$bodyRow.clone();
                    if (isEditable) {
                        $tr.append(this.$bodyCheckboxItem.clone());
                    }

                    for (var j in row) {

                        $cell = this.$bodyCell.clone();
                        $cell.html(reformat(row[j]));
                        $tr.append($cell);
                    }

                    $tr.appendTo($table);
                }
            }
            else {
                // show a null-message row
                //
                $tr = this.$bodyRow.clone();
                $cell = this.$bodyCell.clone();
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