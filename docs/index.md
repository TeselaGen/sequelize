![logo](manual/asset/logo-small.png)
<span class="sequelize">Sequelize</span>

[![Travis build](https://img.shields.io/travis/sequelize/sequelize/master.svg?style=flat-square)](https://travis-ci.org/sequelize/sequelize)
[![npm](https://img.shields.io/npm/dm/sequelize.svg?style=flat-square)](https://npmjs.org/package/sequelize)
[![npm](https://img.shields.io/npm/v/sequelize.svg?style=flat-square)](https://github.com/sequelize/sequelize/releases)

Sequelize is a promise-based ORM for Node.js v4 and up. It supports the dialects PostgreSQL, MySQL, SQLite MSSQL and Oracle and features solid transaction support, relations, read replication and
more.

[Installation](manual/installation/getting-started)

## Example usage

```js
const Sequelize = require('sequelize');
const sequelize = new Sequelize('database', 'username', 'password');

const User = sequelize.define('user', {
  username: Sequelize.STRING,
  birthday: Sequelize.DATE
});

sequelize.sync()
  .then(() => User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20)
  }))
  .then(jane => {
    console.log(jane.get({
      plain: true
    }));
  });
```
