const MAX_ITEMS = 10;
const UP_ARROW = "ArrowUp";
const DOWN_ARROW = "ArrowDown";
const ENTER_KEY = "Enter";
const WAIT_TIME_MS = 150;

let $searchInput = document.getElementById("search");
let $searchResults = document.querySelector(".search-results");
let $searchResultsItems = document.querySelector(".search-results__items");

let searchItemSelected = null;
let resultsItemsIndex = -1;

////////////////////////////////////
// Interaction with the search input
////////////////////////////////////
document.addEventListener("keyup", function (keyboardEvent) {
    if (["s", "S", "/"].includes(keyboardEvent.key)) {
        $searchInput.focus();
    }
});

document.addEventListener("keydown", function (keyboardEvent) {
    const len = $searchResultsItems.getElementsByTagName("li").length - 1;

    if (keyboardEvent.key === DOWN_ARROW) {
        downArrow(len);
    } else if (keyboardEvent.key === UP_ARROW) {
        upArrow(len);
    } else if (keyboardEvent.key === ENTER_KEY) {
        searchItemSelected.getElementsByTagName("a")[0].click();
    }
});

function downArrow(len) {
    resultsItemsIndex++;

    if (!searchItemSelected) {
        resultsItemsIndex = 0;
        searchItemSelected = $searchResultsItems.getElementsByTagName("li")[0];
    } else {
        removeClass(searchItemSelected, "selected");
        const next = $searchResultsItems.getElementsByTagName("li")[resultsItemsIndex];

        if (typeof next !== undefined && resultsItemsIndex <= len) {
            searchItemSelected = next;
        } else {
            resultsItemsIndex = 0;
            searchItemSelected = $searchResultsItems.getElementsByTagName("li")[0];
        }
    }

    searchItemSelected.focus()
    addClass(searchItemSelected, "selected");
}

function upArrow(len) {
    if (!searchItemSelected) {
        resultsItemsIndex = -1;
        searchItemSelected = $searchResultsItems.getElementsByTagName("li")[len];
    } else {
        removeClass(searchItemSelected, "selected");
        resultsItemsIndex--;
        const next = $searchResultsItems.getElementsByTagName("li")[resultsItemsIndex];

        if (typeof next !== undefined && resultsItemsIndex >= 0) {
            searchItemSelected = next;
        } else {
            resultsItemsIndex = len;
            searchItemSelected = $searchResultsItems.getElementsByTagName("li")[len];
        }
    }
    searchItemSelected.focus()
    addClass(searchItemSelected, "selected");
}

function removeClass(el, className) {
    if (el.classList) {
        el.classList.remove(className);
    } else {
        el.className = el.className.replace(new RegExp("(^|\\b)" + className.split(" ").join("|") + "(\\b|$)", "gi"), " ");
    }
}

function addClass(el, className) {
    if (el.classList) {
        el.classList.add(className);
    } else {
        el.className += " " + className;
    }
}

///////////////////////////////
// Autoload of the search input
///////////////////////////////
if (document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll)) {
    initSearch();
} else {
    document.addEventListener("DOMContentLoaded", initSearch);
}

function initSearch() {
    const options = {
        bool: "AND",
        fields: {
            title: {boost: 2},
            body: {boost: 1},
        }
    };
    let currentTerm = "";
    let index;

    const initIndex = async function () {
        if (index === undefined) {
            index = fetch("/search_index.en.json")
                .then(
                    async function (response) {
                        return await elasticlunr.Index.load(await response.json());
                    }
                );
        }
        return await index;
    }

    $searchInput.addEventListener("keyup", debounce(async function () {
        let term = $searchInput.value.trim();
        if (term === currentTerm) {
            return;
        }
        $searchResults.style.display = term === "" ? "none" : "block";
        $searchResultsItems.innerHTML = "";
        currentTerm = term;
        if (term === "") {
            return;
        }

        let results = (await initIndex()).search(term, options);
        if (results.length === 0) {
            results.push({
                ref: "",
                doc: {
                    title: "Nothing found",
                    body: "Try something else",
                }
            })
        }

        for (let i = 0; i < Math.min(results.length, MAX_ITEMS); i++) {
            const item = document.createElement("li");
            item.innerHTML = formatSearchResultItem(results[i], term.split(" "));
            $searchResultsItems.appendChild(item);
        }
    }, WAIT_TIME_MS));

    window.addEventListener('click', function (e) {
        if ($searchResults.style.display === "block" && !$searchResults.contains(e.target)) {
            $searchResults.style.display = "none";
        }
    });
    $searchInput.addEventListener("keyup", function (keyboardEvent) {
        if (keyboardEvent.key === DOWN_ARROW || keyboardEvent.key === UP_ARROW || keyboardEvent.key === ENTER_KEY) {
            return;
        }

        searchItemSelected = null;
        resultsItemsIndex = -1;
        debounce(showResults(index), WAIT_TIME_MS)();
    });

    // Hide results when user press on the "x" placed inside the search field
    $searchInput.addEventListener("search", () => $searchResults.style.display = "");
    $searchInput.addEventListener("focusin", function () {
        if ($searchInput.value !== "") {
            showResults(index)();
        }
    });

    $searchInput.addEventListener("focusout", function () {
        resultsItemsIndex = -1;
    });

    window.addEventListener("click", function (mouseEvent) {
        if ($searchResults.style.display === "block") {
            if (mouseEvent.target !== $searchInput) {
                $searchResults.style.display = "";
            }
        }
    });
}

function debounce(func, wait) {
    let timeout;

    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);

        timeout = setTimeout(function () {
            timeout = null;
            func.apply(context, args);
        }, wait);
    };
}

function showResults(index) {
    if (index === undefined || typeof index.search !== "function") {
        return;
    }
    return function () {
        let $searchInput = window.$searchInput || null;
        if ($searchInput === undefined || $searchInput === null) return;

        const term = $searchInput.value.trim();
        $searchResults.style.display = term === "" ? "" : "block";
        $searchResultsItems.innerHTML = "";
        if (term === "") {
            $searchResults.style.display = "";
            return;
        }

        const options = {
            bool: "AND",
            fields: {
                title: {boost: 2},
                body: {boost: 1}
            },
            expand: true
        };

        const results = index.search(term, options);
        if (results.length === 0) {
            return;
        }

        const numberOfResults = Math.min(results.length, MAX_ITEMS);
        for (let i = 0; i < numberOfResults; i++) {
            createMenuItem(results[i], i);
        }
    }
}

function createMenuItem(result, index) {
    const item = document.createElement("li");
    item.innerHTML = formatSearchResultItem(result);
    item.addEventListener("mouseenter", (mouseEvent) => {
        removeSelectedClassFromSearchResult();
        mouseEvent.target.classList.add("selected");
        searchItemSelected = mouseEvent.target;
        resultsItemsIndex = index;
    })
    item.addEventListener("click", () => $searchInput.value = "")
    $searchResultsItems.appendChild(item);
}

function formatSearchResultItem(item, terms) {
    if (item.ref === "") {
        return '<div class="search-results__item empty">'
            + `<span class="search-results__item-title empty">${item.doc.title}</span>`
            + `<div class="search-results__item-body empty">${item.doc.body}</div>`
            + '</div>';
    }

    return '<div class="search-results__item">'
        + `<a href="${item.ref}">`
        + `<span class="search-results__item-title">${item.doc.title}</span>`
        + `<div class="search-results__item-body">${makeTeaser(item.doc.body, terms)}</div>`
        + `</a>`
        + '</div>';
}

function removeSelectedClassFromSearchResult() {
    const $searchResultsItemChildren = $searchResultsItems.children;
    for (let i = 0; i < $searchResultsItemChildren.length; i++) {
        removeClass($searchResultsItemChildren[i], "selected")
    }
}

// Taken from mdbook
// The strategy is as follows:
// First, assign a value to each word in the document:
//  Words that correspond to search terms (stemmer aware): 40
//  Normal words: 2
//  First word in a sentence: 8
// Then use a sliding window with a constant number of words and count the
// sum of the values of the words within the window. Then use the window that got the
// maximum sum. If there are multiple maximas, then get the last one.
// Enclose the terms in <b>.
function makeTeaser(body, terms) {
    let TERM_WEIGHT = 40;
    let NORMAL_WORD_WEIGHT = 2;
    let FIRST_WORD_WEIGHT = 8;
    let TEASER_MAX_WORDS = 25;

    let stemmedTerms = terms.map(function (w) {
        return elasticlunr.stemmer(w.toLowerCase());
    });
    let termFound = false;
    let index = 0;
    let weighted = []; // contains elements of ["word", weight, index_in_document]

    // split in sentences, then words
    let sentences = body.toLowerCase().split(". ");

    for (let i in sentences) {
        let words = sentences[i].split(" ");
        let value = FIRST_WORD_WEIGHT;

        for (let j in words) {
            let word = words[j];

            if (word.length > 0) {
                for (let k in stemmedTerms) {
                    if (elasticlunr.stemmer(word).startsWith(stemmedTerms[k])) {
                        value = TERM_WEIGHT;
                        termFound = true;
                    }
                }
                weighted.push([word, value, index]);
                value = NORMAL_WORD_WEIGHT;
            }

            index += word.length;
            index += 1;  // ' ' or '.' if last word in sentence
        }

        index += 1;  // because we split at a two-char boundary '. '
    }

    if (weighted.length === 0) {
        return body;
    }

    let windowWeights = [];
    let windowSize = Math.min(weighted.length, TEASER_MAX_WORDS);
    // We add a window with all the weights first
    let curSum = 0;
    for (let i = 0; i < windowSize; i++) {
        curSum += weighted[i][1];
    }
    windowWeights.push(curSum);

    for (let i = 0; i < weighted.length - windowSize; i++) {
        curSum -= weighted[i][1];
        curSum += weighted[i + windowSize][1];
        windowWeights.push(curSum);
    }

    // If we didn't find the term, just pick the first window
    let maxSumIndex = 0;
    if (termFound) {
        let maxFound = 0;
        // backwards
        for (let i = windowWeights.length - 1; i >= 0; i--) {
            if (windowWeights[i] > maxFound) {
                maxFound = windowWeights[i];
                maxSumIndex = i;
            }
        }
    }

    let teaser = [];
    let startIndex = weighted[maxSumIndex][2];
    for (let i = maxSumIndex; i < maxSumIndex + windowSize; i++) {
        let word = weighted[i];
        if (startIndex < word[2]) {
            // missing text from index to start of `word`
            teaser.push(body.substring(startIndex, word[2]));
            startIndex = word[2];
        }

        // add <em/> around search terms
        if (word[1] === TERM_WEIGHT) {
            teaser.push("<b>");
        }
        startIndex = word[2] + word[0].length;
        teaser.push(body.substring(word[2], startIndex));

        if (word[1] === TERM_WEIGHT) {
            teaser.push("</b>");
        }
    }
    teaser.push("…");
    return teaser.join("");
}
