/*jslint browser:true*/
/*global requirejs*/
requirejs(['pouchdb-3.0.6.min'], function (Pouchdb) {
    'use strict';
    var db = new Pouchdb('mekton'),
        changed = false,
        elements = {},
        updateSelection,
        showStats;

    elements.charType = document.getElementById('chartype');
    elements.stats = document.querySelector('#result > div');

    showStats = function (err, doc) {
        var stats;
        if (err) {
            console.error('Error doc retrieval', err);
            return;
        }
        try {
            stats = JSON.stringify(doc.role_stats[Math.floor(Math.random() * 10)]);
        } catch (e) {
            console.error("Error, result is not a json object", e);
            return;
        }
        elements.stats.innerHTML = stats;
    };

    elements.charType.addEventListener('change', function (event) {
        db.get(event.target.value, showStats);
    });

    updateSelection = function () {
        db.query('local/typesWithName', {reduce: false, key: 'archetype'}, function (err, list) {
            var options = '<option>Archetype...</option>';
            if (err) {
                console.error('Error retrieving typesWithName', err);
                return;
            }
            elements.charType.innerHTML = '';
            if (Array.isArray(list.rows)) {
                list.rows.forEach(function (archetype) {
                    options += '<option value="' + archetype.id  + '">' + archetype.value.name + '</option>';
                });
                elements.charType.innerHTML = options;
            }
        });
    };
    Pouchdb.replicate('https://picouch.eemco.nl/mekton', 'mekton', {live: true, filter: 'mekton/typedDocs'})
        .on('change', function (info) {
            console.log('change', info);
            changed = true;
        }).on('complete', function (info) {
            console.log('complete', info);
            updateSelection();
        }).on('uptodate', function (info) {
//            console.log('uptodate', info);
            if (changed) {
                updateSelection();
                changed = false;
            }
        }).on('error', function (err) {
            console.error('error', err);
        });
    updateSelection();
});
