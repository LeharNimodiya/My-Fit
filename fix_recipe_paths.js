const fs = require('fs');
const path = require('path');

// --- Configuration ---
const projectRoot = __dirname;
const dataFilePath = path.join(projectRoot, 'full_recipe_data.json');
const mappingFilePath = path.join(projectRoot, 'image_mapping.json'); // Path to the new mapping file
const sourceImageDir = path.join(projectRoot, 'Recipe', 'image_for_cuisines'); // The folder where your images currently are
const targetImageBaseDir = path.join(projectRoot, 'images', 'recipes'); // The folder where images should be

/**
 * Converts a string to a web-friendly format (kebab-case).
 * @param {string} name The string to convert.
 * @returns {string} The formatted string.
 */
function toKebabCase(name) {
    if (!name) return '';
    return name
        .toString().toLowerCase()
        .replace(/&/g, '-and-')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

/**
 * Main function to fix recipe image paths and file locations using a mapping file.
 */
async function fixRecipePaths() {
    console.log('Starting recipe path and file synchronization...');

    if (!fs.existsSync(sourceImageDir)) {
        console.error(`❌ Source image directory not found: ${sourceImageDir}`);
        console.error('Please ensure your recipe images are in the "Recipe/image_for_cuisines" folder.');
        return;
    }

    if (!fs.existsSync(mappingFilePath)) {
        console.error(`❌ Mapping file not found: ${mappingFilePath}`);
        console.error('Please run "node create_image_map.js" first to generate the mapping file.');
        return;
    }

    let recipeData;
    try {
        const dataFileContent = fs.readFileSync(dataFilePath, 'utf8');
        recipeData = JSON.parse(dataFileContent);
    } catch (error) {
        console.error(`❌ Error reading or parsing data file at ${dataFilePath}: ${error.message}`);
        return;
    }

    const imageMapping = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
    // Create a quick lookup map from recipe ID to source image filename
    const mappingLookup = new Map(imageMapping.map(item => [item.id, item.sourceImage]));

    let isDataModified = false;

    for (const mealType in recipeData) {
        if (recipeData.hasOwnProperty(mealType)) {
            console.log(`\nProcessing "${mealType}" recipes...`);
            const targetMealTypeDir = path.join(targetImageBaseDir, mealType);
            if (!fs.existsSync(targetMealTypeDir)) {
                fs.mkdirSync(targetMealTypeDir, { recursive: true });
            }

            for (const recipe of recipeData[mealType]) {
                // Generate the ideal new filename and URI
                const newImageName = `${toKebabCase(recipe.name)}_${recipe.id}.jpg`;
                const newLocalPath = path.join(targetMealTypeDir, newImageName);
                const newImageUri = `images/recipes/${mealType}/${newImageName}`;

                // Find the original image file from our explicit mapping
                const sourceFileName = mappingLookup.get(recipe.id);

                if (sourceFileName) {
                    const sourceFilePath = path.join(sourceImageDir, sourceFileName);
                    if (fs.existsSync(sourceFilePath)) {
                        if (!fs.existsSync(newLocalPath)) {
                        fs.renameSync(sourceFilePath, newLocalPath);
                        console.log(`✅ Moved & Renamed: "${path.basename(sourceFilePath)}" -> "${path.join('images', 'recipes', mealType, newImageName)}"`);
                        }
                    } else {
                        console.warn(`🟡 Warning: Mapped image "${sourceFileName}" for "${recipe.name}" not found in source directory.`);
                    }
                } else if (!fs.existsSync(newLocalPath)) { // Only warn if the final file doesn't exist AND there was no mapping
                    console.warn(`🟡 Warning: Source image for "${recipe.name}" not found in ${sourceImageDir}.`);
                }

                // Update the JSON if the path is incorrect
                if (recipe.image !== newImageUri) {
                    recipe.image = newImageUri;
                    isDataModified = true;
                }
            }
        }
    }

    if (isDataModified) {
        fs.writeFileSync(dataFilePath, JSON.stringify(recipeData, null, 4), 'utf8');
        console.log('\n✅ Successfully updated image paths in full_recipe_data.json!');
    } else {
        console.log('\n✅ No path changes needed in full_recipe_data.json.');
    }

    console.log('\nSynchronization complete.');
}

fixRecipePaths();