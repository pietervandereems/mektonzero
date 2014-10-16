/*jslint browser:true*/
/*global requirejs*/
requirejs(['pouchdb-3.0.6.min'], function (Pouchdb) {
    'use strict';
    var db = new Pouchdb('mekton'),
        changed = false,
        elements = {},
        elmDefaults = {},
        updateSelection,
        showStats;

    elements.charType = document.getElementById('chartype');
    elements.stats = document.getElementById('stats');
    elements.edge = document.getElementById('edge');
    elmDefaults.stats = elements.stats.innerHTML;

    showStats = function (err, doc) {
        var stats,
            edges;
        if (err) {
            console.error('Error doc retrieval', err);
            return;
        }
        elements.edge.innerHTML = '';
        edges = Object.keys(doc.edge);
        edges.forEach(function (edge) {
            elements.edge.innerHTML += '<p>' + edge + ': ' + doc.edge[edge] + '</p>';
        });
        if (Array.isArray(doc.role_stats) && doc.role_stats.length > 0) {
            elements.stats.innerHTML = elmDefaults.stats;
            stats = Object.keys(doc.role_stats[0]);
            stats.forEach(function (stat) {
                if (stat === 'nr') {
                    return;
                }
                var row = elements.stats.insertRow();
                row.innerHTML = '<td>' + stat + '</td><td>' + doc.role_stats[Math.floor(Math.random() * 10)][stat] + '</td>';
            });
        }
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
    Pouchdb.replicate('https://zero.mekton.nl/db/mekton', 'mekton', {live: true, filter: 'mekton/typedDocs'})
        .on('change', function (info) {
            console.log('change', info);
            changed = true;
        }).on('complete', function (info) {
            console.log('complete', info);
            updateSelection();
        }).on('uptodate', function () {
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
