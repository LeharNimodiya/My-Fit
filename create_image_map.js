const fs = require('fs');
const path = require('path');

// --- Configuration ---
const projectRoot = __dirname;
const dataFilePath = path.join(projectRoot, 'full_recipe_data.json');
const sourceImageDir = path.join(projectRoot, 'Recipe', 'image_for_cuisines');
const mappingFilePath = path.join(projectRoot, 'image_mapping.json');

/**
 * Converts a string to a web-friendly format (kebab-case).
 * This is the same helper function from fix_recipe_paths.js
 * @param {string} name The string to convert.
 * @returns {string} The formatted string.
 */
function toKebabCase(name) {
    if (!name) return '';
    return name
        .toString()
        .toLowerCase()
        .replace(/^\d+\./, '') // Remove numeric prefixes like "200."
        .replace(/&/g, '-and-')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\b(recipe|style|and|with|in|on|the|a|an)\b/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

/**
 * Tries to find the best matching image file for a given recipe name.
 * This is used to pre-populate the mapping file to make manual editing easier.
 * @param {string} recipeName The name of the recipe.
 * @param {string[]} availableFiles A list of all available image filenames.
 * @returns {string} The best guess for the filename, or an empty string.
 */
function findBestGuessImage(recipeName, availableFiles) {
    const recipeWords = new Set(toKebabCase(recipeName).split('-'));
    let bestMatch = { file: '', score: 0 };

    for (const file of availableFiles) {
        const fileWithoutExt = toKebabCase(path.parse(file).name);
        const fileWords = fileWithoutExt.split('-');
        if (fileWords.length === 0) continue;

        let matchCount1 = 0;
        fileWords.forEach(word => {
            if (recipeWords.has(word)) matchCount1++;
        });
        const score1 = matchCount1 / fileWords.length;

        let matchCount2 = 0;
        recipeWords.forEach(word => {
            if (fileWords.includes(word)) matchCount2++;
        });
        const score2 = recipeWords.size > 0 ? matchCount2 / recipeWords.size : 0;
        const score = Math.max(score1, score2);

        if (score > bestMatch.score) {
            bestMatch = { file: file, score: score };
        }
    }

    // Only return a guess if the score is reasonably high
    return bestMatch.score > 0.3 ? bestMatch.file : '';
}

/**
 * Main function to generate the image_mapping.json file.
 */
function createImageMapping() {
    console.log('Generating image mapping file...');

    if (!fs.existsSync(sourceImageDir)) {
        console.error(`❌ Source image directory not found: ${sourceImageDir}`);
        return;
    }

    const recipeData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    const availableImages = fs.readdirSync(sourceImageDir);
    const mapping = [];

    for (const mealType in recipeData) {
        for (const recipe of recipeData[mealType]) {
            mapping.push({
                id: recipe.id,
                name: recipe.name,
                sourceImage: findBestGuessImage(recipe.name, availableImages) // Make a best guess
            });
        }
    }

    const successfullyGuessed = mapping.filter(item => item.sourceImage !== '').length;
    const needsManualMapping = mapping.length - successfullyGuessed;

    fs.writeFileSync(mappingFilePath, JSON.stringify(mapping, null, 4), 'utf8');

    console.log(`\n✅ Successfully created image_mapping.json with ${mapping.length} recipes.`);
    console.log(`🤖 The script made a best guess for ${successfullyGuessed} images.`);
    console.log(`✍️ You need to manually map the remaining ${needsManualMapping} images.`);
    console.log('👉 Please open image_mapping.json and verify/correct the "sourceImage" for each recipe.');
    console.log('After you have corrected the map, run "node fix_recipe_paths.js" to finalize the process.');
}

createImageMapping();