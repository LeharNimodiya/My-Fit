const fs = require('fs');
const path = require('path');

// --- Configuration ---
const projectRoot = __dirname;
const sourceDataPath = path.join(projectRoot, 'data.json');
const cleanedDataPath = path.join(projectRoot, 'data_cleaned.json');

/**
 * Cleans a string by removing excessive whitespace, newlines, and tabs.
 * It preserves the line-by-line structure for lists.
 * @param {string} text The raw string to clean.
 * @returns {string} The cleaned string.
 */
function cleanString(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
        .split('\n') // Split into individual lines
        .map(line => line.trim()) // Remove leading/trailing whitespace from each line
        .filter(line => line.length > 0) // Remove any empty lines
        .join('\n'); // Join them back together with a single newline
}

/**
 * Main function to read, clean, and save the recipe data.
 */
function cleanRecipeData() {
    console.log(`Reading raw data from ${sourceDataPath}...`);

    if (!fs.existsSync(sourceDataPath)) {
        console.error(`❌ Source data file not found: ${sourceDataPath}`);
        return;
    }

    const rawData = JSON.parse(fs.readFileSync(sourceDataPath, 'utf8'));

    console.log(`Cleaning ${rawData.length} recipes...`);

    const cleanedData = rawData.map(recipe => ({
        ...recipe,
        ingredients: cleanString(recipe.ingredients),
        instructions: cleanString(recipe.instructions)
    }));

    fs.writeFileSync(cleanedDataPath, JSON.stringify(cleanedData, null, 4), 'utf8');
    console.log(`\n✅ Successfully created cleaned data file at: ${cleanedDataPath}`);
}

cleanRecipeData();