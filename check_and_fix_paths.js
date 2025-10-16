const fs = require('fs');
const path = require('path');

// The root directory of your project
const projectRoot = __dirname; 
const dataFilePath = path.join(projectRoot, 'app_data.json');
const imagesDir = path.join(projectRoot, 'images');

/**
 * Converts a string to a web-friendly format (kebab-case).
 * Example: "Bench Press" -> "bench-press"
 * @param {string} name - The string to convert.
 * @returns {string} The formatted string.
 */
function toKebabCase(name) {
    return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * The main function to run the path checking and fixing logic.
 */
async function syncImagePaths() {
    console.log('Starting image path synchronization...');

    // --- Step 1: Read the data.js file ---
    let dataFileContent;
    try {
        dataFileContent = fs.readFileSync(dataFilePath, 'utf8');
    } catch (error) {
        console.error(`Error: Could not read data file at ${dataFilePath}. Make sure app_data.json exists.`);
        return;
    }

    // --- Step 2: Load the data using a more robust method ---
    let appData;
    try {
        appData = JSON.parse(dataFileContent);
    } catch (e) {
        console.error(`Error: Failed to parse JSON from app_data.json. ${e.message}`);
        return;
    }
    let isDataModified = false;

    // --- Step 3: Check and rename physical directories ---
    console.log('\nChecking and fixing image directory names...');
    const directories = fs.readdirSync(imagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const dirName of directories) {
        const correctDirName = toKebabCase(dirName);
        if (dirName !== correctDirName) {
            const oldPath = path.join(imagesDir, dirName);
            const newPath = path.join(imagesDir, correctDirName);
            try {
                fs.renameSync(oldPath, newPath);
                console.log(`✅ Renamed directory: "${dirName}" -> "${correctDirName}"`);
            } catch (error) {
                console.error(`❌ Failed to rename directory "${dirName}": ${error.message}`);
            }
        }
    }

    // --- Step 4: Check and update image paths in the workoutData object ---
    console.log('\nChecking and fixing image paths in data.js...');
    for (const category of appData.workoutData.categories) {
        for (const workout of category.workouts) {
            const correctFolderName = toKebabCase(workout.name);
            
            const workoutDir = path.join(imagesDir, correctFolderName);
            if (fs.existsSync(workoutDir)) {
                const newImagePaths = [];
                const imageFiles = fs.readdirSync(workoutDir).filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));

                imageFiles.forEach((fileName, index) => {
                    const extension = path.extname(fileName);
                    const correctFileName = `${correctFolderName}_${index + 1}${extension}`;
                    const oldFilePath = path.join(workoutDir, fileName);
                    const newFilePath = path.join(workoutDir, correctFileName);

                    // Rename the physical file if its name is not correct
                    if (fileName !== correctFileName) {
                        try {
                            fs.renameSync(oldFilePath, newFilePath);
                            console.log(`✅ Renamed file: "${path.join(correctFolderName, fileName)}" -> "${path.join(correctFolderName, correctFileName)}"`);
                        } catch (error) {
                            console.error(`❌ Failed to rename file "${fileName}": ${error.message}`);
                        }
                    }
                    newImagePaths.push(`images/${correctFolderName}/${correctFileName}`);
                });

                // Check if the image paths in the data object need updating
                const originalPaths = JSON.stringify(workout.images);
                const newPaths = JSON.stringify(newImagePaths);

                if (originalPaths !== newPaths) {
                    console.log(`🔧 Updating image paths for "${workout.name}" in data.js`);
                    workout.images = newImagePaths;
                    isDataModified = true;
                }

            } else if (workout.images && workout.images.length > 0) {
                // This handles cases where the directory might have been renamed in Step 3
                // and we just need to update the path in the data file.
                workout.images = workout.images.map(imgPath => {
                    const fileName = path.basename(imgPath);
                    return `images/${correctFolderName}/${fileName}`;
                });
                isDataModified = true;
            }
        }
    }

    // --- Step 5: Write the updated data back to data.js if changes were made ---
    if (isDataModified) {
        console.log('\nData has been modified. Writing changes back to data.js...');
        // Pretty-print the object to maintain readability
        const updatedDataString = JSON.stringify(appData, null, 4);
        
        try {
            fs.writeFileSync(dataFilePath, updatedDataString, 'utf8');
            console.log('✅ Successfully updated app_data.json!');
        } catch (error) {
            console.error(`❌ Failed to write updated data to data.js: ${error.message}`);
        }
    } else {
        console.log('\nNo inconsistencies found. All paths are correct!');
    }

    console.log('\nSynchronization complete.');
}

// Run the script
syncImagePaths();
