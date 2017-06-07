var knex = require('knex')({ client: "oracle" });

var sql = knex.schema.withSchema("LIMS")
            .createTable('reallly_Long_Nammmememememmmemememmememememmemmeememmememem', (table) => {
                table.increments("id");
                table.string("name").defaultTo("adam");
            })
            .toString();

console.log(sql);

var sqlObj = knex.schema.withSchema("LIMS")
            .createTable('name', (table) => {
                table.increments("id");
                table.string("name").defaultTo("adam");
            })
            .toSQL();

console.log(sqlObj);

sqlObj = knex.schema
            .createTable('Users', (table) => {
                table.integer("id");
                table.string("name").defaultTo("adam");
            })
            .toSQL();

console.log(sqlObj);

sqlObj = knex.schema
            .dropTableIfExists('Users')
            .toSQL();

sql = 'begin execute immediate \'' + sqlObj[0].sql + " cascade constraints purge\'; " + sqlObj[1].sql.slice(('begin ').length) 

console.log(sqlObj);
console.log(sql);