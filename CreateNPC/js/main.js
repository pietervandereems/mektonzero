/*jslint browser:true*/
/*global requirejs*/
requirejs(['pouchdb-3.0.6.min'], function (Pouchdb) {
    'use strict';
    var db = new Pouchdb('mekton'),
        changed = false,
        elements = {},
        elmDefaults = {},
        character = {},
        updateSelection,
        generateStats,
        generateSkills,
        generateEdge,
        display,
        displaySkills,
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
            findStatOfSkill;
        if (!Array.isArray(doc.starting_skills)) {
            return;
        }
        // Add the skill to the internal skilllist.
        addToSkillList = function (skill, value, stat, unique) {
            character.skills[stat] = character.skills[stat] || {};
            if (unique && character.skills[stat][skill]) { // Skill must be unique
                return false;
            }
            character.skills[stat][skill] = character.skills[stat][skill] || 0;
            character.skills[stat][skill] += value;
            return true;
        };
        // Determine the stat the skill belongs to
        findStatOfSkill = function (skillDoc, skill) {
            var statList = Object.keys(skillDoc.Stats),
                i;
            if (skill.substr(0, 7) === 'Expert:') { // Group all expert subskill under the expert skill
                skill = 'Expert';
            }
            for (i = statList.length - 1; i >= 0; i -= 1) {
                if (skillDoc.Stats[statList[i]].indexOf(skill) > -1) {
                    return statList[i];
                }
            }
            return "Unkown";
        };
        // Gather all available skills, so we know where to place everything and can choose a skill from a category if needed.
        db.query('local/typesWithName', {reduce: false, key: 'skills', include_docs: true}, function (err, list) {
            var skillDoc;
            if (err || !Array.isArray(list.rows) || list.rows.length === 0) {
                return;
            }
            character.skills = {};
            skillDoc = list.rows[0].doc;
            // Loop through characters starting skills.
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
                } else { // Skill is a specfic skill
                    addToSkillList(skill, level, findStatOfSkill(skillDoc, skill));
                }
            });
            // All character skill proccessed. Now list them in the skills table
            displaySkills();
        });
    };
    // Get the archetype edge and display it.
    generateEdge = function (doc) {
        var edges;
        character.edge = {};
        edges = Object.keys(doc.edge);
        edges.forEach(function (edge) {
            character.edge[edge] = doc.edge[edge];
        });
    };
    // Randomly determine character stats based on archetype.
    generateStats = function (doc) {
        var stats;
        character.stats = {};
        if (Array.isArray(doc.role_stats) && doc.role_stats.length > 0) {
            stats = Object.keys(doc.role_stats[0]);
            stats.forEach(function (stat) {
                if (stat === 'nr') {
                    return;
                }
                character.stats[stat] = doc.role_stats[Math.floor(Math.random() * 10)][stat];
            });
        }
    };

    // **
    // Display Character
    // **

    // Display all characteristics that are available synchronously
    display = function () {
        var edges,
            stats;

        // Edges
        edges = Object.keys(character.edge);
        elements.edge.innerHTML = '';
        edges.forEach(function (edge) {
            elements.edge.innerHTML += '<p>' + edge + ': ' + character.edge[edge] + '</p>';
        });

        // Stats
        stats = Object.keys(character.stats);
        elements.stats.innerHTML = elmDefaults.stats;
        stats.forEach(function (stat) {
            var row = elements.stats.insertRow();
            row.innerHTML = '<td>' + stat + '</td><td>' + character.stats[stat] + '</td>';
        });

    };
    // Skilllist needs to be retrieved asynchronously so a seperate function to display those.
    displaySkills = function () {
        var stats;
        stats = Object.keys(character.skills);
        elements.skills.innerHTML = elmDefaults.skills;
        stats.forEach(function (stat) {
            var row = elements.skills.insertRow(),
                rowInner = '',
                skills;
            rowInner += '<td>' + stat + '</td><td>';
            skills = Object.keys(character.skills[stat]);
            skills.forEach(function (skill) {
                rowInner += skill + ": " + character.skills[stat][skill] + '<br/>';
            });
            row.innerHTML = rowInner + '</td>';
        });
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
            display();
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
