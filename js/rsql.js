/* create assert function
 example : assert( obj === null, 'object was not null!' );
 error message appears in javascript console, if any.
 credit to: Ayman Hourieh http://aymanh.com/
 */

function AssertException(message) {
    this.message = message;
}
AssertException.prototype.toString = function () {
    return 'AssertException: ' + this.message;
};
function assert(exp, message) {
    if (!exp) {
        throw new AssertException(message);
    }
}

// column name quoter
//
function quoteIdentifier(name) {
    function simple(name) {
        var nmParts = name.split('.');
        var outParts = [];
        for (var np in nmParts) {
            if (np.substr(0, 1) === '"') {
                outParts.push(nmParts[np]);
            }
            else {
                outParts.push('"' + nmParts[np].replace(/"/g, '""') + '"');
            }
        }
        return outParts.join('.');
    }

    if (name.substr(0, 1) === '"')
        return name;
    else
        return simple(name);
}

// DatabaseManager that uses an SQLEngine object for database access
//
function DatabaseManager(sqlEngine) {

    // dict of aliases of type names
    //
    var alias = {
        'int2': 'smallint',
        'int4': 'integer',
        'int8': 'bigint',
        'bool': 'boolean',
        'float4': 'real',
        'float8': 'real',
        'float16': 'double precision',
        'bpchar': 'character'
    };

    this.sqlEngine = sqlEngine;

    // function to handle error result of query submit
    function errback(err) {
        if (!window.console) {
            window.console = {};
            window.console.log = alert;
        }
        window.console.log(err[0] + ':' + err[1]);
    }

    var queryTableNames = "SELECT tablename, schemaname FROM pg_tables                              " +
        "WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'  ";
    this.getTableNames = function (display) {
        this.sqlEngine.queryRows({
            'callback': display,
            'q': queryTableNames,
            'errback': errback
        });
    };

    var queryViewNames = "SELECT viewname, schemaname FROM pg_views \n                 " +
        "WHERE schemaname NOT IN('information_schema', 'pg_catalog'); ";
    this.getViewNames = function (display) {
        this.sqlEngine.queryRows({
            'q': queryViewNames,
            'callback': display,
            'errback': errback
        });
    };

    var querySchemaNames = "SELECT nspname FROM pg_namespace \n" +
        "WHERE nspowner > 10 ";
    this.getSchemaNames = function (display) {
        this.sqlEngine.queryRows({
            'q': querySchemaNames,
            'callback': display,
            'errback': errback
        });
    };

    var queryFunctionNames = 'SELECT p.oid::regprocedure, p.oid, p.proname, t.typname ' +
        ' FROM pg_proc p JOIN pg_type t ON t.oid = p.prorettype  ' +
        'WHERE proowner = (                                      ' +
        '    SELECT usesysid FROM "pg_user"                      ' +
        '      WHERE usename = (SELECT CURRENT_USER) );          ';
    this.getFunctionNames = function (display) {
        this.sqlEngine.queryRows({
            'q': queryFunctionNames,
            'callback': display,
            'errback': errback
        });
    };

    this.getSidePanelNames = function (which, cBack) {
        var qParts = [];
        if (which.indexOf('t') > -1) {
            qParts.push(queryTableNames);
        }
        if (which.indexOf('v') > -1) {
            qParts.push(queryViewNames);
        }
        if (which.indexOf('s') > -1) {
            qParts.push(querySchemaNames);
        }
        if (which.indexOf('f') > -1) {
            qParts.push(queryFunctionNames);
        }
        qParts.push('SELECT 1'); // ensure list not empty
        var query = qParts.join(';');
        this.sqlEngine.query({
            'q': query,
            'callback': cBack,
            'errback': errback
        });
    };

    this.getDatabaseSchema = function (display) {
        var query =
            "SELECT c.oid, s.nspname||'.'||c.relname, \n" +
            "       a.attnum, a.attname, t.typname, \n" +
            "       pg_get_expr(d.adbin,d.oid,true) AS deflt, \n" +
            "       (not a.attnotnull)::boolean AS is_nullable, \n" +
            "		information_schema._pg_char_max_length( \n" +
            "				 information_schema._pg_truetypid(a.*,t.*), \n" +
            "				 information_schema._pg_truetypmod(a.*,t.*) \n" +
            "			)::information_schema.cardinal_number AS character_max_length, \n" +
            "		information_schema._pg_numeric_precision(  \n" +
            "				 information_schema._pg_truetypid(a.*,t.*), \n" +
            "				 information_schema._pg_truetypmod(a.*,t.*) \n" +
            "			)::information_schema.cardinal_number AS numeric_precision, \n" +
            "		information_schema._pg_numeric_scale(  \n" +
            "				 information_schema._pg_truetypid(a.*,t.*), \n" +
            "				 information_schema._pg_truetypmod(a.*,t.*) \n" +
            "			)::information_schema.cardinal_number AS numeric_scale, \n" +
            "		a.attndims,  \n" +
            "       t.typelem    \n" +
            "  FROM pg_attribute a  \n" +
            "          JOIN pg_type t ON a.atttypid = t.oid \n" +
            "          JOIN pg_class c ON a.attrelid = c.oid \n" +
            "          JOIN pg_namespace s ON c.relnamespace = s.oid \n" +
            "          LEFT JOIN pg_attrdef d    \n" +
            "                   ON c.oid = d.adrelid AND a.attnum = d.adnum \n" +
            " WHERE s.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') \n" +
            "   AND relkind IN ('r', 'v') \n" +
            "   AND position('_' in c.relname) <> 1 \n" +
            "   AND not a.attisdropped \n" +
            "   AND a.attnum >= 0  \n" +
            " ORDER BY 2, 4 \n" +
            " OFFSET %s ";

        function processDatabaseSchema(columns) {
            var table, tableName, column, curTableName = "";
            var result = [];
            for (var i in columns) {
                if (columns.hasOwnProperty(i)) {
                    tableName = columns[i][1];
                    if (tableName !== curTableName) {
                        table = new ResourceMeta(tableName);
                        // table.nameResource(tableName);
                        result.push(table);
                        curTableName = tableName;
                    }
                    column = new SQLColumn();
                    column.loadData(table, columns[i]);
                    table.addColumn(column);
                }
            }
            display(result);
        }

        var SE = this;

        function getMultiple(callback, query, offset) {
            var q = query.replace('%s', offset.toString());
            var results = [];

            function getMore(res) {
                results = results.concat(res);
                if (res.length >= 100) {
                    offset = offset + 100;
                    q = query.replace('%s', offset.toString());
                    SE.sqlEngine.queryRows({
                        'callback': getMore,
                        'q': q
                    });
                }
                else {
                    callback(results);
                }
            }

            SE.sqlEngine.queryRows({
                'callback': getMore,
                'q': q
            });
        }

        getMultiple(processDatabaseSchema, query, 0);
    };

    this.getView = function (schema, view, callback, errback) {
        function cback(json) {
            var result = [];
            for (var i in json.records.rows) {
                if (json.records.rows.hasOwnProperty(i)) {
                    result.push(json.records.rows[i]);
                }
            }
            callback(result);
        }

        var query = "SELECT * FROM pg_views \n  " +
            "WHERE schemaname = %s \n   " +
            "  AND viewname = %s ;      ";
        var args = [schema, view];
        this.sqlEngine.query({
            'callback': cback,
            'errback': errback,
            'q': query,
            'args': args
        });
    };

    /*
     gets array *element* type rows from pg_types, where the table column
     query retrieved the *array* columns themselves, and we still
     need the rows that describe the element type.
     a field 'int[]', for example, will get an _int type record with the
     getTableDetails query below, and a non-zero typelem field.  This
     query will get the int type record referenced by the typelem
     field value.
     */
    this.getArrayColumns = function (table, callback, errback) {
        /* callback iterates over list of array elem types,
         matches up each rec with column in table, and copies
         data over.
         @param table : table object
         @param callback : function to call with data
         @param errback : function to call in case of error
         */
        function cback(json) {
            var rec, col;
            for (var i in json.records.rows) {
                // iterate over retrieved records
                if (json.records.rows.hasOwnProperty(i)) {
                    rec = json.records.rows[i];
                    for (var j in table.getColumns()) {
                        // iterate over table columns
                        col = table.getColumns()[j];
                        if (col.pos === rec[0]) {
                            // if rec matches this column, copy data
                            col.dataType = alias[rec[1]] || rec[1];
                            col.maxLength = rec[3];
                            col.precision = rec[5];
                            col.scale = rec[6];
                        }
                    }
                }
            }
            callback(table);
        }

        var arQry =
            "SELECT a.attnum, at.typname, at.typelem, \n" +
            "  information_schema._pg_char_max_length(k.typelem,a.atttypmod \n" +
            "    )::information_schema.cardinal_number AS character_max_length, \n" +
            "  information_schema._pg_numeric_precision(k.typelem,a.atttypmod \n" +
            "    )::information_schema.cardinal_number AS numeric_precision, \n" +
            "  information_schema._pg_numeric_scale(k.typelem,a.atttypmod \n" +
            "    )::information_schema.cardinal_number AS numeric_scale \n" +
            " FROM pg_attribute a  \n" +
            "	        JOIN pg_type k ON a.atttypid = k.oid  \n" +
            "			JOIN pg_type at ON k.typelem = at.oid \n" +
            "   WHERE a.attrelid =  " + table.tableOID;
        this.sqlEngine.query({
            'q': arQry,
            'callback': cback,
            'errback': errback
        });
    };

    this.getTableDetails = function (schemaName, tableName, callback, errback) {

        var that = this,
            table = new ResourceMeta(),
            rows = [];
        table.nameResource(schemaName, tableName);

        function cback(json) {

            var column,
                includesArray = false;

            if (json.status[0] === 'incomplete') {

                rows.push.apply(rows, json.records.rows);
                getMoreRecords(rows.length);
            }
            else {

                rows.push.apply(rows, json.records.rows);
                for (var i in rows) {

                    column = new SQLColumn();
                    column.loadData(table, rows[i]);
                    if (column.typelem > 0) {
                        includesArray = true;
                    }

                    table.addColumn(column);
                }

                if (includesArray) {
                    that.getArrayColumns(table, callback, errback);
                }
                else {
                    callback(table);
                }
            }
        }

        var query =
            "SELECT c.oid, c.relname, a.attnum, a.attname, t.typname,                      \n" +
            "       pg_get_expr(d.adbin, c.oid, true) AS deflt,                            \n" +
            "       not a.attnotnull AS is_nullable,                                       \n" +
            "		information_schema._pg_char_max_length(                                \n" +
            "				 information_schema._pg_truetypid(a.*,t.*),                    \n" +
            "				 information_schema._pg_truetypmod(a.*,t.*)                    \n" +
            "			   )::information_schema.cardinal_number AS character_max_length,  \n" +
            "		information_schema._pg_numeric_precision(                              \n" +
            "				 information_schema._pg_truetypid(a.*,t.*),                    \n" +
            "				 information_schema._pg_truetypmod(a.*,t.*)                    \n" +
            "			   )::information_schema.cardinal_number AS numeric_precision,     \n" +
            "		information_schema._pg_numeric_scale(                                  \n" +
            "				 information_schema._pg_truetypid(a.*,t.*),                    \n" +
            "				 information_schema._pg_truetypmod(a.*,t.*)                    \n" +
            "			   )::information_schema.cardinal_number AS numeric_scale,         \n" +
            "		a.attndims,                                                            \n" +
            "       t.typelem                                                              \n" +
            "  FROM pg_attribute a                                                         \n" +
            "          JOIN pg_type t ON a.atttypid = t.oid                                \n" +
            "          JOIN pg_class c ON a.attrelid = c.oid                               \n" +
            "          JOIN pg_namespace s ON c.relnamespace = s.oid                       \n" +
            "          LEFT JOIN pg_attrdef d                                              \n" +
            "                   ON c.oid = d.adrelid AND a.attnum = d.adnum                \n" +
            " WHERE c.relname = %s                                                         \n" +
            "   AND s.nspname = %s                                                         \n" +
            "   AND not a.attisdropped                                                     \n" +
            "   AND a.attnum >= 0                                                          \n" +
            "ORDER BY a.attnum                                                             \n" +
            "OFFSET %s                                                                       ";

        function getMoreRecords(offset) {

            that.sqlEngine.query({
                'q': query,
                'args': [tableName, schemaName, offset],
                'callback': cback,
                'errback': errback
            });
        }

        getMoreRecords(0);

    };

    this.getIndexes = function (schemaName, tableName, callback, errback) {
        function cback(json) {
            var result = [];
            if (json.records.rows) {
                for (var i = 0; i < json.records.rows.length; i += 1) {
                    result.push(json.records.rows[i]);
                }
            }
            callback(result);
        }

        // select indexes and their column names
        var query1 =
            " SELECT pi.indnatts AS attr_num, pi.indisunique AS is_unique,       \n" +
            "   pi.indisprimary AS is_primary,                                   \n" +
            "   pc.relname AS index_name, pctn.relname AS table_name,            \n" +
            "   pg_catalog.pg_get_indexdef(pi.indexrelid, 0, true) AS index_def, \n" +
            "   ARRAY(SELECT DISTINCT a.attname                                  \n" +
            "         FROM pg_index c                                            \n" +
            "               JOIN pg_class t ON c.indexrelid  = t.oid             \n" +
            "                   LEFT JOIN pg_attribute a ON a.attrelid = t.oid   \n" +
            "         WHERE t.oid = pc.oid),                                     \n" +
            "   obj_description(pi.indexrelid,'pg_class') AS comment             \n" +
            "  FROM pg_index AS pi                                               \n" +
            "   INNER JOIN pg_class AS pc ON pi.indexrelid=pc.oid                \n" +
            "     INNER JOIN pg_class AS pctn ON pi.indrelid=pctn.oid            \n" +
            "     JOIN pg_namespace ON pctn.relnamespace = pg_namespace.oid      \n" +
            " WHERE pctn.relname = %s                                            \n" +
            "   AND pg_namespace.nspname = %s                                      ";
        this.sqlEngine.query({
            'q': query1,
            'args': [tableName, schemaName],
            'callback': cback,
            'errback': errback
        });
    };

    this.getConstraints = function (schemaName, tableName, callback, errback) {
        function cback(json) {
            var result = [];
            if (json.records && json.records.rows) {
                for (var i = 0; i < json.records.rows.length; i += 1) {
                    result.push(json.records.rows[i]);
                }
            }
            callback(result);
        }

        // select indexes and their column names
        var query =
            " SELECT pc.conname, pc.contype, pc.conrelid, pc.confrelid,   \n" +
            "   pc.confupdtype, pc.confdeltype, pc.confmatchtype,     \n" +
            "   pc.conkey, pc.confkey, pc.conpfeqop, pc.conppeqop,    \n" +
            "   pc.conffeqop, pg_get_constraintdef(pc.oid) as consrc, \n" +
            "   fc.relname as fortable, fs.nspname as forschema,      \n" +
            "   obj_description(pc.oid,'pg_class') AS comment         \n" +
            "  FROM pg_constraint AS pc                               \n" +
            "          JOIN pg_class c ON pc.conrelid = c.oid         \n" +
            "          JOIN pg_namespace s ON c.relnamespace = s.oid  \n" +
            "		   LEFT JOIN pg_class fc ON pc.confrelid = fc.oid     \n" +
            "		   LEFT JOIN pg_namespace fs ON fc.relnamespace = fs.oid \n" +
            " WHERE c.relname = %s                                    \n" +
            "   AND s.nspname = %s ";
        this.sqlEngine.query({
            'q': query,
            'args': [tableName, schemaName],
            'callback': cback,
            'errback': errback
        });
    };

    this.getTriggers = function (schemaName, tableName, callback, errback) {
        var query = 'SELECT t.tgname AS name,                                  \n' +
            '       n.nspname AS schema,                               \n' +
            '       tb.relname AS table,                               \n' +
            '       CASE t.tgtype & cast(2 as int2)                    \n' +
            '          WHEN 0 THEN \'AFTER\'                           \n' +
            '          ELSE \'BEFORE\'                                 \n' +
            '       END AS timing,                                     \n' +
            '       CASE t.tgtype & cast(28 as int2)                   \n' +
            '          WHEN 16 THEN \'UPDATE\'                         \n' +
            '          WHEN  8 THEN \'DELETE\'                         \n' +
            '          WHEN  4 THEN \'INSERT\'                         \n' +
            '          WHEN 20 THEN \'INSERT, UPDATE\'                 \n' +
            '          WHEN 28 THEN \'INSERT, UPDATE, DELETE\'         \n' +
            '          WHEN 24 THEN \'UPDATE, DELETE\'                 \n' +
            '          WHEN 12 THEN \'INSERT, DELETE\'                 \n' +
            '       END AS event,                                      \n' +
            '       CASE t.tgtype & cast(1 as int2)                    \n' +
            '          WHEN 0 THEN \'STATEMENT\'                       \n' +
            '          ELSE \'ROW\'                                    \n' +
            '       END AS foreach,                                    \n' +
            '       p.proname AS function,                             \n' +
            '       obj_description(t.oid,\'pg_trigger\') AS comment   \n' +
            'FROM pg_trigger t                                         \n' +
            '   JOIN pg_class tb ON tb.oid = t.tgrelid                 \n' +
            '   JOIN pg_namespace n ON tb.relnamespace = n.oid         \n' +
            '   JOIN pg_proc p ON p.oid = t.tgfoid                     \n' +
            'WHERE t.tgconstraint = 0                                  \n' +
            '  AND tb.relname = %s                                     \n' +
            '  AND n.nspname = %s                                        ';

        function cback(json) {
            var result = [];
            if (json.records && json.records.rows) {
                for (var i = 0; i < json.records.rows.length; i += 1) {
                    result.push(json.records.rows[i]);
                }
            }
            callback(result);
        }

        this.sqlEngine.query({
            'q': query,
            'args': [tableName, schemaName],
            'callback': cback,
            'errback': errback
        });
    };

    /*
     SELECT p.oid::regprocedure as fullname,
     p.proname, n.nspname, p.proretset, p.provolatile,
     p.pronargs, p.prorettype, p.proargtypes, p.proallargtypes,
     p.proargmodes, p.proargnames, p.prosrc, p.probin
     FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE proowner = (SELECT usesysid FROM "pg_user"
     WHERE usename = (SELECT CURRENT_USER) )
     AND (p.oid::regprocedure::text)  = 'namenumbers(integer)';
     */

    this.getFunctionsList = function (fullname, callback, errback) {
        var query = "SELECT p.oid::regprocedure as fullname, p.oid, \n" +
            "       p.proname, n.nspname, p.proretset, p.provolatile, \n" +
            "       p.pronargs, p.prorettype, p.proargtypes, p.proallargtypes, \n" +
            "       p.proargmodes, p.proargnames, p.prosrc, p.proisagg, \n" +
            "       p.prosecdef, p.proisstrict, p.probin, l.lanname \n" +
            "  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid \n" +
            "           JOIN pg_language l on l.oid = p.prolang\n" +
            " WHERE proowner = \n" +
            "    (SELECT usesysid FROM \"pg_user\" \n" +
            "      WHERE usename = (SELECT CURRENT_USER) ) \n" +
            "   AND p.oid::regprocedure::text = '~fname~';".replace('~fname~', fullname);
        // query = query.replace('-schema-', schname);
        /* proname, pronamespace, proowner, prolang, procost,
         prorows, provariadic, proisagg, proiswindow, prosecdef,
         proisstrict, proretset, provolatile, pronargs, pronargdefaults,
         prorettype, proargtypes, proallargtypes, proargmodes, proargnames,
         proargdefaults, prosrc, brobin, proconfig, proacl
         */
        function cback(json) {
            var result = [];
            if (json.row_count[0] > 0) {
                for (var i in json.records.rows) {
                    if (json.records.rows.hasOwnProperty(i)) {
                        result.push(json.records.rows[i]);
                    }
                }
            }
            callback(result);
        }

        this.sqlEngine.query({
            'q': query,
            'callback': cback,
            'errback': errback
        });
    };
    this.getTableOID = function (schemaName, tableName, callback, errback) {
        // get table id
        var query = "SELECT c.oid, n.nspname, c.relname FROM pg_catalog.pg_class c \n" +
            "LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace \n" +
            "WHERE c.relname = %s \n" +
            "  AND n.nspname = %s \n" +
            "ORDER BY 2, 3;";

        function withOID(toid) {
            var table_id = toid.records.rows[0][0];
            callback(table_id);
        }

        this.sqlEngine.query({
            'q': query,
            'args': [tableName, schemaName],
            'callback': withOID,
            'errback': errback
        });
    };

    this.getColumnComments = function (table_oid, columns, callback, errback) {
        if (columns.length === 0) {
            callback([]);
            return;
        }
        var queryparts = [];
        for (var i = 0; i < columns.length; i += 1) {
            queryparts.push("col_description(" + table_oid + "," + columns[i].pos + ")");
        }
        var query = "SELECT " + queryparts.join(',') + ";";

        function cback(json) {
            var comments = [];
            for (var i in json.records.rows[0]) {
                comments.push(json.records.rows[0][i]);
            }
            callback(comments);
        }

        this.sqlEngine.query({
            'q': query,
            'callback': cback,
            'errback': errback
        });
    };

    this.getTableComment = function (tableOID, callback, errback) {
        var query = "SELECT obj_description(" + tableOID + ",'pg_class');";

        function extractTableComment(json) {
            if (json.records.rows[0][0]) {
                callback(json.records.rows[0][0]);
            }
            else {
                callback("");
            }
        }

        this.sqlEngine.query({
            'q': query,
            'callback': extractTableComment,
            'errback': errback
        });
    };

    this.getObjectComment = this.getTableComment;

    this.renameTable = function (oldname, newname, callback, errback) {
        var query = 'ALTER TABLE ' + quoteIdentifier(oldname) +
            ' RENAME TO ' + quoteIdentifier(newname) + ';';
        this.sqlEngine.query({
            'q': query,
            'callback': callback,
            'errback': errback
        });
    };

    this.dropTable = function (tableName, callback, errback) {
        var query = 'DROP TABLE ' + quoteIdentifier(tableName) + ';';
        this.sqlEngine.query({
            'q': query,
            'callback': callback,
            'errback': errback
        });
    };

    this.truncate = function (tableName, callback, errback) {
        var query = 'TRUNCATE TABLE ' + quoteIdentifier(tableName) + ';';
        this.sqlEngine.query({
            'q': query,
            'callback': callback,
            'errback': errback
        });
    };

    this.getTypeByOID = function (oid, callback, errback) {
        var query = [];
        for (var i in oid) {
            query.push("(SELECT ROW(oid, typname) FROM pg_type WHERE oid=" + oid[i] + ') as c' + i);
        }
        var queryTxt = 'SELECT ' + query.join(", \n");

        function cback(json) {
            var result = [];
            if (json.row_count[0] > 0) {
                for (var j in json.records.rows) {
                    result.push(json.records.rows[j]);
                }
            }
            callback(result);
        }

        this.sqlEngine.query({
            'q': queryTxt,
            'callback': cback,
            'errback': errback
        });
    };

    this.getAllTypes = function (cback) {
        var q = "SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid    \n" +
            " WHERE n.nspname not in ('public','pg_toast','pg_catalog',                     \n" +
            "                         'pg_temp_1','pg_toast_temp_1','information_schema')   \n" +
            "   AND typelem = 0                                                             \n" +
            "   AND typarray > 0                                                            \n" +
            "   AND typreceive > 0                                                          ";

        this.sqlEngine.query({
            'q': q,
            'callback': cback,
            'errback': errback
        });
    };


    this.getPrivileges = function (cback) {

        var queryACLItems =
            "SELECT datacl FROM pg_database WHERE datname = current_database();                       \n" +
            "----                                                                                     \n" +
            "SELECT nspname::VARCHAR(256) AS name, nspname AS schema, 'schema' AS type,                             \n" +
            "       nspacl::VARCHAR AS acl, a.rolname AS owner                                        \n" +
            "  FROM pg_namespace n JOIN pg_roles a ON n.nspowner =  a.oid                             \n" +
            " WHERE (n.nspowner > 10 OR n.nspname = 'public') AND a.rolname != 'postgres'             \n" +
            "UNION                                                                                    \n" +
            "SELECT p.oid::regprocedure::VARCHAR(256), n.nspname, 'function',                              \n" +
            "       p.proacl::VARCHAR, a.rolname                                                      \n" +
            "  FROM pg_proc p                                                                         \n" +
            "         JOIN pg_namespace n ON p.pronamespace = n.oid                                   \n" +
            "             JOIN pg_roles a ON p.proowner = a.oid                                       \n" +
            " WHERE (n.nspowner > 10 OR n.nspname = 'public') AND a.rolname != 'postgres2'            \n" +
            "UNION                                                                                    \n" +
            "SELECT c.relname::VARCHAR(256), n.nspname,                                                             \n" +
            "       CASE WHEN c.relkind='r' THEN 'table'                                              \n" +
            "            WHEN c.relkind='v' THEN 'view'                                               \n" +
            "            WHEN c.relkind='s' THEN 'sequence'                                           \n" +
            "       END,                                                                              \n" +
            "       c.relacl::VARCHAR, a.rolname                                                      \n" +
            "  FROM pg_class c                                                                        \n" +
            "          LEFT JOIN pg_namespace n ON n.oid = c.relnamespace                             \n" +
            "             JOIN pg_roles a ON c.relowner = a.oid                                       \n" +
            " WHERE (n.nspowner > 10 OR n.nspname = 'public') AND a.rolname != 'postgres2'            \n" +
            "   AND c.relkind in ('v','r','s');                                                       \n";

        this.sqlEngine.query({
            'q': queryACLItems,
            'callback': cback,
            'errback': errback
        });
    }

}

// object to hold meta-data for table
//   contains SQLColumn elements
//
function ResourceMeta(tName) {

    // split table name
    //
    function splitTableName(name) {

        assert(name, 'name to be split is falsy');
        var delim = (name.substr(0, 1) === '"') ? '"."' : '.',
            sNtN;
        if (name.indexOf(delim) >= 0) {
            sNtN = name.split(delim);
            if (delim.substr(0, 1) === '"') {
                sNtN[0] = sNtN[0] + '"';
                sNtN[1] = '"' + sNtN[1];
            }
            return [sNtN[0], sNtN[1]];
        }
        else {
            return ['public', name];
        }
    }
    
    var tableName = "",
        schemaName = "",
        comment = "",
        fields = [];

    this.nameResource = function (arg0, arg1) {

        if (arg1) {
            schemaName = arg0;
            if (schemaName === "")
                schemaName = "public";
            tableName = arg1;
        }
        else if (arg0) {
            var sNtN = splitTableName(arg0);
            schemaName = sNtN[0];
            tableName = sNtN[1];
        }
        else {
            schemaName = "public";
            tableName = "";
        }
        return this;
    };
    if (tName) {
        this.nameResource(tName);
    }

    this.qualResourceName = function () {
        if (schemaName === "public") {
            return tableName;
        }
        else {
            return schemaName + '.' + tableName;
        }
    };

    this.quotedResourceName = function () {
        if (schemaName === "public") {
            return quoteIdentifier(tableName);
        }
        else {
            return quoteIdentifier(schemaName) + '.' + quoteIdentifier(tableName);
        }
    };

    this.quotedTableNameOnly = function () {
        return quoteIdentifier(tableName);
    };

    this.quotedSchemaNameOnly = function () {
        return quoteIdentifier(schemaName);
    };

    this.addColumn = function (column) {
        fields.push(column);
    };

    this.getColumns = function () {
        var cols = [];
        for (var i in fields) {
            if (fields.hasOwnProperty(i)) {
                cols.push(fields[i]);
            }
        }
        return cols;
    };

    this.addComment = function (commnt) {
        comment = commnt;
    };

    this.getComment = function () {
        return comment;
    };

    this.getSchemaNameOnly = function () {
        return schemaName;
    };

    this.getTableNameOnly = function () {
        return tableName;
    };

    this.getFunctionNameOnly = function () {
        var fNameParts = tableName.split('(');
        return fNameParts[0];
    };

    this.getQuotedFunctionName = function () {
        var parts = tableName.split('('),
            fName = parts[0],
            args = parts[1].substr(0, parts[1].length - 1).split(','),
            quotedArgs;

        if (args[0] === '')
            args = [parts[1]];
        quotedArgs = _.map(args, function (m) {
            return quoteIdentifier(m)
        });

        return quoteIdentifier(fName) + '(' + args.join(',') + ')';
    };


    this.toStr = function () {
        var result = tableName + "\n\n";
        for (var i in fields) {
            if (fields.hasOwnProperty(i)) {
                var col = fields[i];
                result = result + col.columnName + " " + col.dataType + "\n";
            }
        }
        return result;
    };
}


// object to hold meta-data about Column
//
function SQLColumn() {
    this.table = null;
    this.references = null;
    this.pos = 0;
    this.columnName = "";
    this.dataType = "";
    this.columnDefault = "";
    this.isNullable = "";
    this.maxLength = "";
    this.precision = "";
    this.numDims = "";
    this.typelem = '';
    this.comment = "";

    this.deleted = false;
    this.added = false;

    this.loadData = function (tab, data) {
        this.table = tab;
        this.table.tableOID = data[0];
        this.pos = data[2];
        this.columnName = data[3];
        this.dataType = alias[data[4]] || data[4];
        this.columnDefault = data[5];
        this.isNullable = data[6]; // ? 'YES' : 'NO';
        this.maxLength = data[7];
        this.precision = data[8];
        this.scale = data[9];
        this.numDims = data[10];  // 0 for nonarrays
        this.typelem = data[11];  // for array types, scalar type oid
        if (data[12]) {
            this.comment = data[12];
        }
    };

    this.sizeString = function () {
        var size = this.maxLength;
        if (this.dataType.toLowerCase() in {'numeric': 1, 'decimal': 2}) {
            size = this.precision + ',' + this.scale;
        }
        return size;
    };

}

