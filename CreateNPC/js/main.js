requirejs(['pouchdb-3.0.6.min'], function (Pouchdb) {
    var db = new Pouchdb('mekton');
    console.log('db', db);
});
