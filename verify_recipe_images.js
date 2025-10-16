const fs = require('fs');
const path = require('path');

// --- Configuration ---
const projectRoot = __dirname;
const dataFilePath = path.join(projectRoot, 'full_recipe_data.json');

/**
 * Main function to verify that image files exist for each recipe in the JSON data.
 */
async function verifyRecipeImages() {
    console.log('Starting recipe image verification...');

    let recipeData;
    try {
        const dataFileContent = fs.readFileSync(dataFilePath, 'utf8');
        recipeData = JSON.parse(dataFileContent);
    } catch (error) {
        console.error(`❌ Error reading or parsing data file at ${dataFilePath}: ${error.message}`);
        return;
    }

    let missingCount = 0;
    let foundCount = 0;

    for (const mealType in recipeData) {
        if (recipeData.hasOwnProperty(mealType)) {
            for (const recipe of recipeData[mealType]) {
                const imagePath = path.join(projectRoot, recipe.image);

                if (fs.existsSync(imagePath)) {
                    foundCount++;
                } else {
                    missingCount++;
                    console.log(`❌ MISSING: Image for "${recipe.name}" not found at path: ${recipe.image}`);
                }
            }
        }
    }

    console.log('\n--- Verification Summary ---');
    if (missingCount === 0) {
        console.log(`✅ Success! All ${foundCount} recipe images were found.`);
    } else {
        console.log(`🟡 Found: ${foundCount} images.`);
        console.log(`❌ Missing: ${missingCount} images. Please check the paths listed above.`);
        console.log('If images are missing, try running "node fix_recipe_paths.js" again.');
    }
    console.log('--------------------------');
}

verifyRecipeImages();