/**
 * tracking.js - handles data storage with Firebase + localStorage backup
 * saves user reading data to Firebase Realtime Database
 */

// ============================================
// FIREBASE CONFIG
// ============================================
var firebaseConfig = {
    apiKey: "AIzaSyBS5G7svfVVDT47YctKali0uppRCEkOI_I",
    authDomain: "hci-news-study.firebaseapp.com",
    databaseURL: "https://hci-news-study-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "hci-news-study",
    storageBucket: "hci-news-study.firebasestorage.app",
    messagingSenderId: "577986892878",
    appId: "1:577986892878:web:f79b9bb7bf4dd9c6685f1f"
};

// firebase app reference
var firebaseApp = null;
var database = null;
var firebaseReady = false;

// try to initialize firebase
function initFirebase() {
    try {
        // check if firebase is loaded
        if (typeof firebase !== 'undefined') {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            database = firebase.database();
            firebaseReady = true;
            console.log('Firebase connected successfully!');
        } else {
            console.warn('Firebase SDK not loaded, using localStorage only');
        }
    } catch (err) {
        console.warn('Firebase init failed:', err.message);
        firebaseReady = false;
    }
}

// initialize when script loads
initFirebase();

// localStorage keys for backup
var STORAGE_KEY = 'hci_study_results';
var EVENTS_KEY = 'hci_study_events';

/**
 * saves a result to both Firebase and localStorage
 */
function saveResult(data) {
    // always save to localStorage as backup
    saveToLocalStorage(data);

    // try to save to firebase
    if (firebaseReady && database) {
        saveToFirebase(data);
    }
}

/**
 * saves data to firebase realtime database
 */
function saveToFirebase(data) {
    try {
        // create a unique key for this result
        var resultsRef = database.ref('results');
        var newResultRef = resultsRef.push();

        newResultRef.set(data)
            .then(function() {
                console.log('Data saved to Firebase:', data.sessionId);
            })
            .catch(function(err) {
                console.warn('Firebase save failed:', err);
            });
    } catch (err) {
        console.warn('Firebase save error:', err);
    }
}

/**
 * saves data to localStorage
 */
function saveToLocalStorage(data) {
    var existing = localStorage.getItem(STORAGE_KEY);
    var results = [];

    if (existing) {
        try {
            results = JSON.parse(existing);
        } catch (e) {
            results = [];
        }
    }

    results.push(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    console.log('Data saved to localStorage');
}

/**
 * gets all results - tries firebase first, falls back to localStorage
 */
function getResults() {
    // for now return localStorage, firebase data shows in console
    var stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    try {
        return JSON.parse(stored);
    } catch (e) {
        return [];
    }
}

/**
 * gets results from firebase (async)
 */
function getFirebaseResults(callback) {
    if (!firebaseReady || !database) {
        callback([]);
        return;
    }

    database.ref('results').once('value')
        .then(function(snapshot) {
            var data = snapshot.val();
            var results = [];

            if (data) {
                // convert object to array
                Object.keys(data).forEach(function(key) {
                    results.push(data[key]);
                });
            }

            callback(results);
        })
        .catch(function(err) {
            console.warn('Firebase read failed:', err);
            callback([]);
        });
}

/**
 * clears all stored results
 */
function clearResults() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(EVENTS_KEY);

    // optionally clear firebase too
    if (firebaseReady && database) {
        database.ref('results').remove()
            .then(function() {
                console.log('Firebase data cleared');
            })
            .catch(function(err) {
                console.warn('Firebase clear failed:', err);
            });
    }

    console.log('All results cleared');
}

/**
 * logs an event with timestamp
 */
function logEvent(eventName, eventData) {
    var events = [];
    var stored = localStorage.getItem(EVENTS_KEY);

    if (stored) {
        try {
            events = JSON.parse(stored);
        } catch (e) {
            events = [];
        }
    }

    var eventObj = {
        event: eventName,
        data: eventData || {},
        timestamp: Date.now(),
        datetime: new Date().toISOString()
    };

    events.push(eventObj);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

    // also save events to firebase
    if (firebaseReady && database) {
        database.ref('events').push().set(eventObj);
    }

    console.log('[EVENT]', eventName, eventData);
}

/**
 * gets all logged events
 */
function getEvents() {
    var stored = localStorage.getItem(EVENTS_KEY);
    if (!stored) return [];

    try {
        return JSON.parse(stored);
    } catch (e) {
        return [];
    }
}

/**
 * exports results as JSON file
 */
function exportResultsAsJSON() {
    var results = getResults();
    var events = getEvents();

    var exportData = {
        results: results,
        events: events,
        exportedAt: new Date().toISOString()
    };

    var jsonStr = JSON.stringify(exportData, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    var link = document.createElement('a');
    link.href = url;
    link.download = 'hci_study_data_' + Date.now() + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * exports results as CSV
 */
function exportResultsAsCSV() {
    var results = getResults();
    if (results.length === 0) {
        alert('No data to export');
        return;
    }

    var headers = ['participantId', 'uiVersion', 'articleId', 'articleTopic', 'startTime', 'endTime', 'readingTimeSec', 'maxScrollDepth', 'distractionClicks', 'focusModeUsed', 'focusModeTimeSec', 'comprehensionScore', 'perceivedFocus', 'perceivedReadability', 'completedAt'];
    var csvLines = [];
    csvLines.push(headers.join(','));

    results.forEach(function(r) {
        var row = headers.map(function(h) {
            var val = r[h];
            if (val === null || val === undefined) return '';
            var str = String(val);
            if (str.indexOf(',') >= 0 || str.indexOf('"') >= 0) {
                str = '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        });
        csvLines.push(row.join(','));
    });

    var csvContent = csvLines.join('\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);

    var link = document.createElement('a');
    link.href = url;
    link.download = 'hci_study_results_' + Date.now() + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * calculates averages for comparison
 */
function calculateAverages() {
    var results = getResults();

    var uiA = results.filter(function(r) { return r.uiVersion === 'A'; });
    var uiB = results.filter(function(r) { return r.uiVersion === 'B'; });

    function avg(arr, key) {
        if (arr.length === 0) return 0;
        var sum = arr.reduce(function(acc, item) {
            return acc + (item[key] || 0);
        }, 0);
        return Math.round(sum / arr.length);
    }

    return {
        uiA: {
            count: uiA.length,
            avgTimeSec: avg(uiA, 'readingTimeSec'),
            avgScroll: avg(uiA, 'maxScrollDepth')
        },
        uiB: {
            count: uiB.length,
            avgTimeSec: avg(uiB, 'readingTimeSec'),
            avgScroll: avg(uiB, 'maxScrollDepth')
        }
    };
}

console.log('tracking.js loaded - Firebase + localStorage mode');
