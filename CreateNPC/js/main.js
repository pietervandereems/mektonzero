/*jslint browser:true*/
/*global requirejs*/
requirejs(['pouchdb-3.0.6.min'], function (Pouchdb) {
    'use strict';
    var db = new Pouchdb('mekton'),
        changed = false,
        elements = {},
        elmDefaults = {},
        updateSelection,
        generateStats,
        generateSkills,
        generateEdge,
        pickSkillFromCategory;

    // **
    // Shortcuts to interface elements
    // **
    elements.charType = document.getElementById('chartype');
    elements.stats = document.getElementById('stats');
    elements.edge = document.getElementById('edge');
    elements.skills = document.getElementById('skills');
    elmDefaults.stats = elements.stats.innerHTML;
    elmDefaults.skills = elements.skills.innerHTML;

    // **
    // Helper functions
    // **

    pickSkillFromCategory = function (category) {
        var skills = Object.keys(category);
        return skills[Math.floor(Math.random() * skills.length)];
    };

    // **
    // Generate character stuff
    // **
    generateSkills = function (doc) {
        var addToSkillList,
            skillList = {};
        if (!Array.isArray(doc.starting_skills)) {
            return;
        }
        addToSkillList = function (skill, value, stat, unique) {
            skillList[stat] = skillList[stat] || {};
            if (unique && skillList[stat][skill]) { // Skill must be unique
                return false;
            }
            skillList[stat][skill] = skillList[stat][skill] || 0;
            skillList[stat][skill] += value;
            return true;
        };
        elements.skills.innerHTML = elmDefaults.skills;
        db.query('local/typesWithName', {reduce: false, key: 'skills', include_docs: true}, function (err, list) {
            var skillDoc,
                printStats;
            if (err || !Array.isArray(list.rows) || list.rows.length === 0) {
                return;
            }
            skillDoc = list.rows[0].doc;
            doc.starting_skills.forEach(function (skillObj) {
                var skill = Object.keys(skillObj)[0],
                    level = skillObj[skill],
                    randSkill,
                    skillAdded;
                if (skillDoc.Categories[skill]) { // Skill is a generic skill from a category, choose a unique one from that category
                    do {
                        randSkill = pickSkillFromCategory(skillDoc.Categories[skill]);
                        skillAdded = addToSkillList(randSkill, level, skillDoc.Categories[skill][randSkill], true);
                    } while (!skillAdded);
                }
            });
            printStats = Object.keys(skillList);
            printStats.forEach(function (printStat) {
                var row = elements.skills.insertRow(),
                    rowInner = '',
                    printSkills;
                rowInner += '<td>' + printStat + '</td><td>';
                printSkills = Object.keys(skillList[printStat]);
                printSkills.forEach(function (printSkill) {
                    rowInner += printSkill + ": " + skillList[printStat][printSkill] + '<br/>';
                });
                row.innerHTML = rowInner + '</td>';
            });
        });
    };
    generateEdge = function (doc) {
        var edges;
        elements.edge.innerHTML = '';
        edges = Object.keys(doc.edge);
        edges.forEach(function (edge) {
            elements.edge.innerHTML += '<p>' + edge + ': ' + doc.edge[edge] + '</p>';
        });
    };
    generateStats = function (doc) {
        var stats;
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

    // **
    // Event Listeners, for user interaction
    // **
    elements.charType.addEventListener('change', function (event) {
        db.get(event.target.value, function (err, doc) {
            if (err) {
                console.error('Error doc retrieval', err);
                return;
            }
            generateEdge(doc);
            generateStats(doc);
            generateSkills(doc);
        });
    });


    // **
    // Update
    // **
    // Fill the archetype selection element.
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

    // **
    // Data
    // **
    // Update local database
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
