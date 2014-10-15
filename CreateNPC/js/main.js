/*jslint browser:true*/
/*global requirejs*/
requirejs(['pouchdb-3.0.6.min'], function (Pouchdb) {
    'use strict';
    var db = new Pouchdb('mekton'),
//        replFilter,
        replication,
        show;

//    replFilter = function (doc) {
//        return !!(doc.type);
//    };
    show = function () {
        db.get('826da529b3a1375247121d380800018d', function (err, doc) {
            if (err) {
                console.log('Error getting doc', err);
                return;
            }
            document.getElementById('doc').innerHTML = JSON.stringify(doc);
        });
    };
    Pouchdb.replicate('http://picuntu:5984/mekton', 'mekton', {live: true, filter: 'mekton/typedDocs'})
        .on('change', function (info) {
            console.log('change', info);
            // handle change
        }).on('complete', function (info) {
            console.log('complete', info);
            show();
            // handle complete
        }).on('uptodate', function (info) {
            console.log('uptodate', info);
            // handle up-to-date
        }).on('error', function (err) {
            console.log('error', err);
            // handle error
        });
    show();
});
