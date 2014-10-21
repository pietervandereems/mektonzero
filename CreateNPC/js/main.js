/*jslint browser:true, nomen:true*/
/*global requirejs*/
requirejs(['pouchdb-3.0.6.min'], function (Pouchdb) {
    'use strict';
    var db = new Pouchdb('mekton'),
        charDb = new Pouchdb('localChars'),
        initialPhase = true,
        localCharacter = {},
        elements = {},
        elmDefaults = {},
        character = {},
        updateSelection,
        updateSavedChar,
        generateStats,
        generateSkills,
        generateEdge,
        generateTraits,
        generateGear,
        display,
        displaySkills,
        displayTraits,
        displayGear,
        pickSkillFromCategory,
        addView;

    // **
    // Shortcuts to interface elements
    // **
    elements.charType = document.getElementById('chartype');
    elements.stats = document.getElementById('stats');
    elements.edge = document.getElementById('edge');
    elements.skills = document.getElementById('skills');
    elements.name = document.getElementById('name');
    elements.saved = document.getElementById('saved');
    elements.save = document.getElementById('save');
    elements.traits = document.getElementById('traits');
    elements.gear = document.getElementById('gear');
    elmDefaults.stats = elements.stats.innerHTML;
    elmDefaults.skills = elements.skills.innerHTML;
    elmDefaults.traits = elements.traits.innerHTML;
    elmDefaults.gear = elements.gear.innerHTML;

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
    generateTraits = function () {
        db.query('local/typesWithName', {reduce: false, key: 'lifepath', include_docs: true}, function (err, list) {
            var doc,
                traitList;
            if (err || !Array.isArray(list.rows) || list.rows.length === 0) {
                return;
            }
            doc = list.rows[0].doc;
            traitList = Object.keys(doc.traits);
            character.traits = {};
            traitList.forEach(function (trait) {
                character.traits[trait] = doc.traits[trait][Math.floor(Math.random() * doc.traits[trait].length)];
            });
            displayTraits();
        });
    };
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
                var skillList = Object.keys(skillObj),
                    skill,
                    level,
                    randSkill,
                    skillAdded;
                if (skillList.length > 1) {
                    skill = skillList[Math.floor(Math.random() * skillList.length)];
                } else {
                    skill = skillList[0];
                }
                level = skillObj[skill];
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
    // Get the archetype edge
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
    // Get the gear
    generateGear = function (doc) {
        character.gear = {};
        if (Array.isArray(doc.starting_gear) && doc.starting_gear.length > 0) {
            db.query('local/typesWithName', {reduce: false, key: 'gear', include_docs: true}, function (err, list) {
                var gearDoc,
                    gearDocList,
                    g;
                if (err || !Array.isArray(list.rows) || list.rows.length === 0) {
                    return;
                }
                gearDoc = list.rows[0].doc;
                gearDocList = Object.keys(gearDoc);
                doc.starting_gear.forEach(function (stuffObj) {
                    var stuffList = Object.keys(stuffObj),
                        gear,
                        gearList,
                        gearSubList,
                        item;
                    if (stuffList.length > 1) {
                        gear = stuffList[Math.floor(Math.random() * stuffList.length)];
                    } else {
                        gear = stuffList[0];
                    }
                    if (gearDoc[gear]) {
                        character.gear[gear] = character.gear[gear] || [];
                        if (Array.isArray(gearDoc[gear])) {
                            character.gear[gear].push(gearDoc[gear][Math.floor(Math.random() * gearDoc[gear].length)]);
                            return;
                        }
                        if (typeof gearDoc[gear] === "object") {
                            gearList = Object.keys(gearDoc[gear]);
                            gearSubList = gearList[Math.floor(Math.random() * gearList.length)];
                            character.gear[gear].push(gearDoc[gear][gearSubList][Math.floor(Math.random() * gearDoc[gear][gearSubList].length)]);
                            return;
                        }
                        character.gear[gearDoc[gear]].push(gearDoc[gear]);
                        return;
                    }
                    for (g = gearDocList.length - 1; g >= 0; g -= 1) {
                        item = gearDocList[g];
                        if (item !== 'type' && item.substr(0, 1) !== '_') {
                            if (typeof item === 'object') {
                                if (item[gear]) {
                                    character.gear[item] = character.gear[item] || [];
                                    character.gear[item] = item[gear][Math.floor(Math.random() * item[gear].length)];
                                    return;
                                }
                            }
                        }
                    }
                    character.gear.Misc = character.gear.Misc || [];
                    character.gear.Misc.push(gear);
                });
                displayGear();
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
    // Traits need to be retrieved asynchronously so a seperate function to display those.
    displayTraits = function () {
        var traits;
        traits = Object.keys(character.traits);
        elements.traits.innerHTML = elmDefaults.traits;
        traits.forEach(function (trait) {
            var row = elements.traits.insertRow();
            row.innerHTML = '<td>' + trait + '</td><td>' + character.traits[trait] + '</td>';
        });
    };
    // Gear need to be retrieved asynchronously so a seperate function to display those.
    displayGear = function () {
        var gearType;
        gearType = Object.keys(character.gear);
        elements.gear.innerHTML = elmDefaults.gear;
        gearType.forEach(function (gear) {
            var row = elements.gear.insertRow(),
                rowInner = '';
            rowInner += '<td>' + gear + '</td><td>';
            character.gear[gear].forEach(function (stuff) {
                rowInner += stuff + '<br/>';
            });
            row.innerHTML = rowInner + '</td>';
        });

    };
    // **
    // Event Listeners, for user interaction
    // **
    // A new archetype is selected
    elements.charType.addEventListener('change', function (event) {
        db.get(event.target.value, function (err, doc) {
            if (err) {
                console.error('Error archetype doc retrieval', err);
                return;
            }
            generateEdge(doc);
            generateStats(doc);
            generateSkills(doc);
            generateTraits();
            generateGear(doc);
            display();
        });
    });

    // The 'save this archetype' is clicked
    elements.save.addEventListener('click', function (event) {
        event.preventDefault();
        if (localCharacter.name && localCharacter.id && localCharacter.name === elements.name.value) {
            if (window.confirm('Overwrite existing character? (name is the same)')) {
                character.archetype = elements.charType.value;
                charDb.put(character, character._id, character._rev, function (err) {
                    if (err) {
                        console.error('Error overwriting character', err);
                        return;
                    }
                    return;
                });
            }
        } else {
            character.name = elements.name.value;
            character.archetype = elements.charType.value;
            charDb.post(character, function (err) {
                if (err) {
                    console.error('Error saving new character', err);
                }
            });
        }
    });

    // A saved character is selected
    elements.saved.addEventListener('change', function (event) {
        charDb.get(event.target.value, function (err, doc) {
            var opts,
                index;
            if (err) {
                console.error('Error character doc retrieval', err);
                return;
            }
            localCharacter = {
                id: doc._id,
                name: doc.name,
                archetype: doc.archetype || ''
            };
            // If possible, set archetype selector to saved archetype
            if (localCharacter.archetype) {
                opts = elements.charType.options;
                for (index = opts.length - 1; index >= 0; index -= 1) {
                    if (opts[index].value === localCharacter.archetype) {
                        elements.charType.selectedIndex = index;
                    }
                }
            }
            // set values
            elements.name.value = doc.name;
            character = doc;
            // display character
            display();
            displaySkills();
            displayTraits();
            displayGear();
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
                    var selected = '';
                    if (localCharacter.archetype === archetype) {
                        selected = 'selected';
                    }
                    options += '<option value="' + archetype.id  + '" ' + selected + '>' + archetype.value.name + '</option>';
                });
                elements.charType.innerHTML = options;
            }
        });
    };

    // Fill saved characters selector
    updateSavedChar = function () {
        charDb.query('local/names', function (err, list) {
            var options = '';
            if (err) {
                if (err.status && err.message && err.status === 404 && err.message === 'missing') {
                    addView('local', updateSavedChar);
                } else {
                    console.error('Error getting view local/names', err);
                }
                return;
            }
            elements.saved.innerHTML = '';
            if (Array.isArray(list.rows) && list.rows.length > 0) {
                list.rows.forEach(function (name) {
                    var selected = '';
                    if (localCharacter.id && localCharacter.id === name.id) {
                        selected = 'selected';
                    }
                    options += '<option value="' + name.id  + '" ' + selected + '>' + name.key + '</option>';
                });
                elements.saved.innerHTML = '<option value="">Names...</option>' + options;
            }
        });
    };

    // **
    // Database
    // **
    addView = function (view, cb) {
        switch (view) {
        case 'local':
            charDb.put({
                '_id': '_design/local',
                'views': {
                    'names': {
                        'map': 'function(doc) { if (doc.name) {\n    emit(doc.name, 1);\n    }\n}'
                    }
                }
            }, function (err) {
                if (err) {
                    console.error('Error saving view', err);
                    return;
                }
                cb();
            });
            break;
        }
    };
    // Get the last sequence nr and start listening for new changes.
    charDb.info(function (err, info) {
        if (err) {
            console.error('Error getting localChars database info', err);
            info = {update_seq: 0};
        }
        updateSavedChar();
        // Listen to changes to local characters database
        // note: info seems to not give us the last sequence nr.
        charDb.changes({continuous: true, since: info.update_seq})
            .on('change', function () {
                if (!initialPhase) {    // we are only interested in changes after the database has been 'read' completely. Possibly a pouchdb problem?
                    updateSavedChar();
                }
            })
            .on('error', function (err) {
                console.error('Error with charDb change', err);
            })
            .on('uptodate', function () {
                initialPhase = false;
                updateSavedChar();
            });
    });
    // Update local mekton database, and listen to replicate events
    Pouchdb.replicate('https://zero.mekton.nl/db/mekton', 'mekton', {live: true, filter: 'mekton/typedDocs'})
        .on('uptodate', function () {
            updateSelection();
        })
        .on('error', function (err) {
            console.error('error', err);
        });
    // Clear fields
    elements.name.value = '';
});
