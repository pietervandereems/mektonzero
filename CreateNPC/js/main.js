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
        addSkillToStat,
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
    elmDefaults.stats = '<caption>Stats</caption>';
    elmDefaults.skills = '<caption>Skills</caption>';
    elmDefaults.traits = '<caption>Traits</caption>';
    elmDefaults.gear = '<caption>Gear</caption>';

    // **
    // Extend
    // **
    String.prototype.capitalize = function () {
        return this.charAt(0).toUpperCase() + this.slice(1);
    };

    // **
    // Helper functions
    // **

    pickSkillFromCategory = function (category) {
        var skills = Object.keys(category);
        return skills[Math.floor(Math.random() * skills.length)];
    };

    addSkillToStat = function (skill, stat) {
        var skillValue = character.skills[stat][skill] || 0,
            statValue = character.stats[stat] || 0;
        return parseInt(skillValue, 10) + parseInt(statValue, 10);
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
            stat = stat.toLowerCase();
            value = parseInt(value, 10);
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
            return "unkown";
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
                stat = stat.toLowerCase();
                character.stats[stat] = parseInt(doc.role_stats[Math.floor(Math.random() * 10)][stat], 10);
            });
        }
    };
    // Get the gear
    generateGear = function (doc) {
        var pickStuff;
        pickStuff = function (objectList) {
            var stuff = {},
                stuffList,
                gear,
                type;
            do {
                stuff = stuff[gear] || objectList;
                stuffList = Object.keys(stuff);
                if (stuffList.length > 1) {
                    gear = stuffList[Math.floor(Math.random() * stuffList.length)];
                } else {
                    gear = stuffList[0];
                }
                type = type || gear;
            } while (typeof stuff[gear] === 'object');
            return {
                type: type,
                gear: gear,
                value: stuff[gear]
            };
        };
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
                    var gear,
                        gearValue,
                        type,
                        gearList,
                        gearSubList,
                        item,
                        choosenGear;
                    choosenGear = pickStuff(stuffObj);
                    gear = choosenGear.gear;
                    gearValue = choosenGear.value;
                    type = choosenGear.type;
                    if (gearDoc[type]) {
                        character.gear[type] = character.gear[type] || [];
                        if (Array.isArray(gearDoc[type])) {
                            character.gear[type].push({
                                gear: gearDoc[type][Math.floor(Math.random() * gearDoc[type].length)],
                                value: gearValue
                            });
                            return;
                        }
                        if (typeof gearDoc[type] === "object") {
                            if (gearDoc[type][gear]) {
                                character.gear[type].push({
                                    gear: gearDoc[type][gear][Math.floor(Math.random() * gearDoc[type][gear].length)],
                                    value: gearValue
                                });
                                return;
                            }
                            gearList = Object.keys(gearDoc[type]);
                            gearSubList = gearList[Math.floor(Math.random() * gearList.length)];
                            character.gear[type].push({
                                gear: gearDoc[type][gearSubList][Math.floor(Math.random() * gearDoc[type][gearSubList].length)],
                                value: gearValue
                            });
                            return;
                        }
                        character.gear[gearDoc[type]].push({
                            gear: gearDoc[type],
                            value: gearValue
                        });
                        return;
                    }
                    for (g = gearDocList.length - 1; g >= 0; g -= 1) {
                        item = gearDocList[g];
                        if (item !== 'type' && item.substr(0, 1) !== '_') {
                            if (typeof item === 'object') {
                                if (item[gear]) {
                                    character.gear[item] = character.gear[item] || [];
                                    character.gear[item] = {
                                        gear: item[gear][Math.floor(Math.random() * item[gear].length)],
                                        value: gearValue
                                    };
                                    return;
                                }
                            }
                        }
                    }
                    character.gear.Misc = character.gear.Misc || [];
                    character.gear.Misc.push({
                        gear: gear,
                        value: gearValue
                    });
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
            stats,
            statRow,
            statValueRow,
            elmStatsInner = '',
            count = 0;
        // Edges
        edges = Object.keys(character.edge);
        elements.edge.innerHTML = '';
        edges.forEach(function (edge) {
            elements.edge.innerHTML += '<p><strong>' + edge + '</strong>: ' + character.edge[edge] + '</p>';
        });

        // Stats
        stats = Object.keys(character.stats);
        elmStatsInner = '<table>' + elmDefaults.stats;
        statRow = '<tr>';
        statValueRow = '<tr>';
        stats.forEach(function (stat) {
            if (count !== 0 && count % 6 === 0) {
                elmStatsInner += statRow + '</tr>' + statValueRow + '</tr></table>';
                elmStatsInner += '<table>' + elmDefaults.stats;
                statRow = '<tr>';
                statValueRow = '<tr>';
            }
            //var row = elements.stats.insertRow();
            //row.innerHTML = '<td>' + stat.capitalize() + '</td><td>' + character.stats[stat] + '</td>';
            statRow += '<th>' + stat.capitalize() + '</th>';
            statValueRow += '<td>' + character.stats[stat] + '</td>';
            count += 1;
        });
        elmStatsInner += statRow + '</tr>' + statValueRow + '</tr></table>';
        elements.stats.innerHTML = elmStatsInner;
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
            rowInner += '<td>' + stat.capitalize() + '</td><td>';
            skills = Object.keys(character.skills[stat]);
            skills.forEach(function (skill) {
                rowInner += skill + ": " + character.skills[stat][skill] + ' <span class="small">(' + addSkillToStat(skill, stat) + ')</span>' + '<br/>';
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
                rowInner += stuff.gear;
                if (stuff.value !== undefined && stuff.value !== null && stuff.value !== '') {
                    rowInner += ' <span class="small">(' + stuff.value + ')</span>';
                }
                rowInner += '<br/>';
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
        if (event.target.value === '') {
            return;
        }
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
