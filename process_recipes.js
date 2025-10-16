const fs = require('fs');
const path = require('path');
const https = require('https');

// --- Configuration ---
const projectRoot = __dirname; // Assumes this script is in the project root
const dataFilePath = path.join(projectRoot, 'full_recipe_data.json');
const imagesBaseDir = path.join(projectRoot, 'images', 'recipes');

/**
 * Converts a string to a web-friendly format (kebab-case).
 * Example: "My Recipe Name" -> "my-recipe-name"
 * @param {string} name The string to convert.
 * @returns {string} The formatted string.
 */
function toKebabCase(name) {
    if (!name) return '';
    return name
        .toString() // Ensure it's a string
        .toLowerCase() // Convert to lowercase
        .replace(/&/g, '-and-') // Replace & with -and-
        .replace(/[^a-z0-9\s-]/g, '') // Remove all non-alphanumeric characters except spaces and hyphens
        .trim() // Remove leading/trailing whitespace
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with a single one
}

/**
 * Downloads an image from a URL and saves it to a local path.
 * @param {string} url The URL of the image to download.
 * @param {string} localPath The path to save the image to.
 * @returns {Promise<void>}
 */
function downloadImage(url, localPath) {
    return new Promise((resolve, reject) => {
        // Ensure the directory exists
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Skip if file already exists
        if (fs.existsSync(localPath)) {
            console.log(`🟡 Skipping download, file already exists: ${path.basename(localPath)}`);
            return resolve();
        }

        const file = fs.createWriteStream(localPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(localPath, () => {}); // Delete the file if an error occurs
            reject(err);
        });
    });
}

/**
 * Main function to process recipes, download images, and update data file.
 */
async function processRecipes() {
    console.log('Starting recipe image processing...');

    // --- 1. Read and parse the data file ---
    let recipeData;
    try {
        const dataFileContent = fs.readFileSync(dataFilePath, 'utf8');
        recipeData = JSON.parse(dataFileContent);
    } catch (error) {
        console.error(`❌ Error reading or parsing data file at ${dataFilePath}: ${error.message}`);
        return;
    }

    let isDataModified = false;

    // --- 2. Iterate through meal types and recipes ---
    for (const mealType in recipeData) {
        if (recipeData.hasOwnProperty(mealType)) {
            console.log(`\nProcessing "${mealType}" recipes...`);
            const mealTypeDir = path.join(imagesBaseDir, mealType);

            for (const recipe of recipeData[mealType]) {
                const imageName = `${toKebabCase(recipe.name)}_${recipe.id}.jpg`;
                const localImagePath = path.join(mealTypeDir, imageName);
                const newImageUri = `images/recipes/${mealType}/${imageName}`;

                // Check if the image is a full URL before trying to download
                const isWebUrl = recipe.image.startsWith('http://') || recipe.image.startsWith('https://');

                try {
                    if (isWebUrl) {
                        await downloadImage(recipe.image, localImagePath);
                    }
                    // Always check if the path needs updating, even if not downloaded this run
                    if (recipe.image !== newImageUri) {
                        console.log(`🔧 Updating image path for "${recipe.name}"`);
                        recipe.image = newImageUri;
                        isDataModified = true;
                    }
                } catch (error) {
                    console.error(`❌ Failed to process image for "${recipe.name}": ${error.message}`);
                }
            }
        }
    }

    // --- 3. Write updated data back to the file ---
    if (isDataModified) {
        console.log('\nWriting updated recipe data to file...');
        fs.writeFileSync(dataFilePath, JSON.stringify(recipeData, null, 4), 'utf8');
        console.log('✅ Successfully updated full_recipe_data.json!');
    } else {
        console.log('\n✅ No changes needed. Recipe data is already up to date.');
    }

    console.log('\nRecipe processing complete.');
}

// Run the script
processRecipes();