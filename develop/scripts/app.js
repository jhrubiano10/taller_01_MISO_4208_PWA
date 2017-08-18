(function () {
    'use strict';

    var app = {
        isLoading: true,
        visibleCards: {},
        selectedTimetables: [],
        spinner: document.querySelector('.loader'),
        cardTemplate: document.querySelector('.cardTemplate'),
        container: document.querySelector('.main'),
        addDialog: document.querySelector('.dialog-container')
    };


    /*****************************************************************************
     *
     * Event listeners for UI elements
     *
     ****************************************************************************/

    document.getElementById('butRefresh').addEventListener('click', function () {
        // Refresh all of the forecasts
        app.updateSchedules();
    });

    document.getElementById('butAdd').addEventListener('click', function () {
        // Open/show the add new city dialog
        app.toggleAddDialog(true);
    });

    document.getElementById('butAddCity').addEventListener('click', function () {


        var select = document.getElementById('selectTimetableToAdd');
        var selected = select.options[select.selectedIndex];
        var key = selected.value;
        var label = selected.textContent;
        if (!app.selectedTimetables) {
            app.selectedTimetables = [];
        }
        app.getSchedule(key, label);
        app.selectedTimetables.push({key: key, label: label});
        app.saveSelectedTimes({key: key, label: label});
        app.toggleAddDialog(false);
    });

    document.getElementById('butAddCancel').addEventListener('click', function () {
        // Close the add new city dialog
        app.toggleAddDialog(false);
    });


    /*****************************************************************************
     *
     * Methods to update/refresh the UI
     *
     ****************************************************************************/

    // Toggles the visibility of the add new city dialog.
    app.toggleAddDialog = function (visible) {
        if (visible) {
            app.addDialog.classList.add('dialog-container--visible');
        } else {
            app.addDialog.classList.remove('dialog-container--visible');
        }
    };

    // Updates a weather card with the latest weather forecast. If the card
    // doesn't already exist, it's cloned from the template.

    app.updateTimetableCard = function (data) {
        var key = data.key;
        var dataLastUpdated = new Date(data.created);
        var schedules = data.schedules;
        var card = app.visibleCards[key];

        if (!card) {
            var label = data.label.split(', ');
            var title = label[0];
            var subtitle = label[1];
            card = app.cardTemplate.cloneNode(true);
            card.classList.remove('cardTemplate');
            card.querySelector('.label').textContent = title;
            card.querySelector('.subtitle').textContent = subtitle;
            card.removeAttribute('hidden');
            app.container.appendChild(card);
            app.visibleCards[key] = card;
        }
        card.querySelector('.card-last-updated').textContent = data.created;

        var scheduleUIs = card.querySelectorAll('.schedule');
        for(var i = 0; i<4; i++) {
            var schedule = schedules[i];
            var scheduleUI = scheduleUIs[i];
            if(schedule && scheduleUI) {
                scheduleUI.querySelector('.message').textContent = schedule.message;
            }
        }

        if (app.isLoading) {
            app.spinner.setAttribute('hidden', true);
            app.container.removeAttribute('hidden');
            app.isLoading = false;
        }
    };

    /*****************************************************************************
     *
     * Methods for dealing with the model
     *
     ****************************************************************************/

    
    app.getSchedule = function (key, label) {
        var url = 'https://api-ratp.pierre-grimaud.fr/v3/schedules/' + key;

        if ('caches' in window) {
            caches.match(url).then(function(response) {
                if (response) {
                    response.json().then(function updateFromCache(json) {
                        console.log("DESDE LA CACHÉ");
                        app.updateTimetableCard({
                            key : key,
                            label : label,
                            created : json._metadata.date,
                            schedules : json.result.schedules
                        });
                    });
                }
            });
        }

        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    var response = JSON.parse(request.response);
                    var result = {};
                    result.key = key;
                    result.label = label;
                    result.created = response._metadata.date;
                    result.schedules = response.result.schedules;
                    app.updateTimetableCard(result);
                }
            } else {
                // Return the initial weather forecast since no data is available.
                app.updateTimetableCard(initialStationTimetable);
            }
        };
        request.open('GET', url);
        request.send();
    };

    // Iterate all of the cards and attempt to get the latest forecast data
    app.updateSchedules = function () {
        var keys = Object.keys(app.visibleCards);
        keys.forEach(function (key) {
            app.getSchedule(key);
        });
    };

    //Para guardar la información en caché/IndexDB...
    app.saveSelectedTimes = function(obj) {
		var store = getObjectStore(DB_STORE_NAME, 'readwrite');
		var req;
		try {
			req = store.add(obj);
		} catch (e) {
			if (e.name == 'DataCloneError'){
				console.log("Error en DataCloneError");
			}
		}

		req.onsuccess = function (evt) {
			console.log("Insertion in DB successful");
		};
		req.onerror = function() {
			console.error("addPublication error", this.error);
		};
	};

    /*
     * Fake weather data that is presented when the user first uses the app,
     * or when the user has not saved any cities. See startup code for more
     * discussion.
     */

    var initialStationTimetable = {

        key: 'metros/1/bastille/A',
        label: 'Bastille, Direction La Défense',
        created: '2017-07-18T17:08:42+02:00',
        schedules: [
            {
                message: '0 mn'
            },
            {
                message: '2 mn'
            },
            {
                message: '5 mn'
            }
        ]
    };

    //Para el manejo de IndexDB...
    var DB_NAME = 'indexeddb-trainsparis';
	var DB_VERSION = 2;
	var DB_STORE_NAME = 'schedules';
	var db;
	//Para abrir la base de datos...
	var openDb = (function() {
		console.log("openDb ...");
		var req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onsuccess = function (evt) {
			db = this.result;
			console.log("openDb DONE");
			getDataIndexDB();
		};
		req.onerror = function (evt) {
			console.error("openDb:", evt.target.errorCode);
		};

		req.onupgradeneeded = function (evt) {
			console.log("openDb.onupgradeneeded");
			var store = evt.currentTarget.result.createObjectStore(
				DB_STORE_NAME, { keyPath: 'id', autoIncrement: true }
			);
			store.createIndex('key', 'key', { unique: false });
			store.createIndex('label', 'label', { unique: false });
		};
	})();
	//Fin de abrir la base de datos...

	//Para traer la información almacenada...
	var getDataIndexDB = function() {
		var store = getObjectStore(DB_STORE_NAME, 'readonly');
		var req;
		req = store.count();
		req.onsuccess = function(evt) {
			console.log('There are ' + evt.target.result +' record(s) in the object store.');
		};
		req.onerror = function(evt) {
			console.error("add error", this.error);
		};
		
		var i = 0;
		req = store.openCursor();
		req.onsuccess = function(evt) {
			var cursor = evt.target.result;
			if (cursor) {
				req = store.get(cursor.key);
				req.onsuccess = function (evt) {
					var value = evt.target.result;
					app.selectedTimetables.push({
						key: value.key, label: value.label
					});
				};
				cursor.continue();
				i++;
			} else {
				//No habían registrados guardados...
				if(i === 0) {
					console.log("GUARDAR LA DATA EN INDEXDB");
                    app.updateTimetableCard(initialStationTimetable);
                    app.selectedTimetables = [
                        {key: initialStationTimetable.key, label: initialStationTimetable.label}
                    ];
					app.saveSelectedTimes(
						{key: initialStationTimetable.key, label: initialStationTimetable.label}
					);
				}
				else {
					console.log("DATA DE INDEXDB");
					console.log(app.selectedTimetables);
					app.selectedTimetables.forEach(function(schedule) {
                        app.getSchedule(schedule.key, schedule.label);
					});
				}
			}
		};
	};
	
	function getObjectStore(store_name, mode) {
		var tx = db.transaction(store_name, mode);
		return tx.objectStore(store_name);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
        .register('./sw.js')
        .then(function() { 
            console.log('Service Worker Registered'); 
        });
    }

})();
