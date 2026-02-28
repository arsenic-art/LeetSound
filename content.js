/**
 * This script detects LeetCode verdicts (Accepted, Wrong Answer, etc.)
 * after a Run or Submit action and plays a corresponding sound.
 *
 * Users can customize:
 * 1. The sound files in VERDICTS_MAP
 * 2. Add new verdict mappings
 * 3. Adjust timing delays (scanTimeout, stabilityTimeout)
 * 4. Modify detection strategy if LeetCode DOM changes
 */


/**
 * Mapping between verdict text and sound file.
 *
 * KEY   = Exact verdict text shown on LeetCode
 * VALUE = Path to sound file inside your extension folder
 *
 * To customize:
 * - Replace sound file names
 * - Add new verdict types
 * - Remove ones you don't want
 */
const VERDICTS_MAP = {
    "Accepted": "sounds/LAUGH.mp3",
    "Wrong Answer": "sounds/FAAAHH.mp3",
    "Time Limit Exceeded": "sounds/CHICKEN.mp3",
    "Memory Limit Exceeded": "sounds/EHEHH.mp3",
    "Runtime Error": "sounds/GEY.mp3",
    "Compile Error": "sounds/DUNDUN.mp3",
    "Output Limit Exceeded": "sounds/FART.mp3",
    "Internal Error": "sounds/FART.mp3"
};


/**
 * Extract all verdict names from the map.
 * This keeps detection dynamic — if user edits VERDICTS_MAP,
 * detection automatically adapts.
 */
const VERDICTS = Object.keys(VERDICTS_MAP);


/**
 * Strings that indicate judging is in progress.
 * When one of these appears, we know verdict hasn't finalized yet.
 *
 * If LeetCode UI changes wording,
 * update this array accordingly.
 */
const RESET_STRINGS = ["Pending", "Judging", "Running", "In Queue"];


/**
 * State variables
 *
 * isJudging         -> Tracks whether a run/submit action is in progress
 * lastClickedButton -> Remembers whether user clicked Run or Submit
 * scanTimeout       -> Debounce timer for DOM mutations
 * stabilityTimeout  -> Ensures verdict text stabilizes before triggering sound
 */
let isJudging = false;
let lastClickedButton = null;
let scanTimeout = null;
let stabilityTimeout = null;


/**
 * Listen globally for clicks.
 *
 * We detect:
 * - Run button click
 * - Submit button click
 *
 * This helps prevent false positives when browsing submissions
 * or viewing old results.
 */
document.addEventListener('click', (e) => {
    const runBtn = e.target.closest('[data-e2e-locator="console-run-button"]');
    const submitBtn = e.target.closest('[data-e2e-locator="console-submit-button"]');

    if (runBtn) {
        lastClickedButton = "Run";
        // console.log("LeetSound: Detected RUN click");
    } else if (submitBtn) {
        lastClickedButton = "Submit";
        // console.log("LeetSound: Detected SUBMIT click");
    }
}, true);


/**
 * Plays sound corresponding to verdict.
 *
 * If verdict not found in map, fallback sound is used.
 *
 * Uses chrome.runtime.getURL to safely reference
 * extension-bundled audio files.
 */
function playSound(verdict) {
    try {
        const soundPath = VERDICTS_MAP[verdict] || "sounds/CHICKEN.mp3";
        const audioUrl = chrome.runtime.getURL(soundPath);
        const audio = new Audio(audioUrl);

        audio.play().catch(err => 
            console.error("LeetSound: Error playing sound", err)
        );
    } catch (e) {
        console.error(
            "LeetSound: Extension context invalidated. Please refresh the LeetCode tab.",
            e
        );
    }
}


/**
 * Main scanning logic.
 *
 * This runs after DOM mutations settle.
 *
 * Steps:
 * 1. Check if judging is ongoing.
 * 2. If judging finished, search for verdict text.
 * 3. Play corresponding sound.
 */
function scanForVerdicts() {

    // Grab entire page text once
    const pageText = document.body.innerText;

    // Check if judging is still happening
    const foundResetString = RESET_STRINGS.some(s => pageText.includes(s));

    if (foundResetString) {
        if (!isJudging) {
            // console.log("LeetSound: Action started (Judging detected)...");
            isJudging = true;
        }
        return;
    }

    // If judging just finished, wait for UI to stabilize
    if (isJudging) {
        clearTimeout(stabilityTimeout);

        stabilityTimeout = setTimeout(() => {

            let foundVerdict = null;
            const allPossibleMatches = [];

            /**
             * Primary detection:
             * Search inside elements that contain data-e2e-locator
             * (LeetCode commonly uses these for important UI parts)
             */
            const e2eElements = document.querySelectorAll('[data-e2e-locator]');
            e2eElements.forEach(el => {
                const text = el.innerText.trim().toLowerCase();

                for (const v of VERDICTS) {
                    if (text.includes(v.toLowerCase())) {
                        allPossibleMatches.push({ verdict: v, element: el });
                    }
                }
            });

            /**
             * Additional detection for Submit flow.
             * Some verdicts are rendered inside <h3> elements.
             */
            if (lastClickedButton === "Submit") {
                const h3Elements = document.querySelectorAll('h3');
                h3Elements.forEach(el => {
                    const text = el.innerText.trim().toLowerCase();

                    for (const v of VERDICTS) {
                        if (text.includes(v.toLowerCase())) {
                            allPossibleMatches.push({ verdict: v, element: el });
                        }
                    }
                });
            }

            /**
             * If we detected possible verdicts:
             * Choose the latest match (most reliable)
             */
            if (allPossibleMatches.length > 0) {

                let bestMatch =
                    allPossibleMatches[allPossibleMatches.length - 1].verdict;

                // console.log(
                //     "LeetSound: Found potential verdicts:",
                //     allPossibleMatches.map(m => m.verdict)
                // );

                // console.log(
                //     `LeetSound: Action finished (${lastClickedButton}) -> ${bestMatch}`
                // );

                playSound(bestMatch);

                // Reset state
                isJudging = false;
                lastClickedButton = null;
            }

        }, 650); // Delay ensures verdict text stabilizes
    }
}


/**
 * MutationObserver watches for DOM updates.
 *
 * LeetCode is a React SPA (no page reload),
 * so verdict appears via DOM changes.
 *
 * We debounce scanning to avoid excessive CPU usage.
 */
const observer = new MutationObserver(() => {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanForVerdicts, 250);
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
});

// console.log("LeetSound: Refined locator-based detection active.");