#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';

// Colors for console
const colors = {
    RED: '\x1b[91m',
    GREEN: '\x1b[92m',
    YELLOW: '\x1b[93m',
    BLUE: '\x1b[94m',
    PURPLE: '\x1b[95m',
    CYAN: '\x1b[96m',
    NC: '\x1b[0m'
};

function printColor(message, color) {
    console.log(color + message + colors.NC);
}

function printBanner() {
    printColor(`
╔══════════════════════════════════════╗
║         KIKAMISHA VERSION CLI        ║
║           Auto-versioning Tool       ║
╚══════════════════════════════════════╝`, colors.CYAN);
}

function getCurrentVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return packageJson.version;
    } catch (error) {
        return '0.0.0';
    }
}

function calculateNewVersion(current, type) {
    const [major, minor, patch] = current.split('.').map(Number);

    switch (type) {
        case 'major': return `${major + 1}.0.0`;
        case 'minor': return `${major}.${minor + 1}.0`;
        case 'patch': return `${major}.${minor}.${patch + 1}`;
        default: return current;
    }
}

function updatePackageVersion(newVersion) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
}

function gitOperations(newVersion, versionType) {
    execSync('git add package.json', { stdio: 'inherit' });

    let commitMessage;
    switch (versionType) {
        case 'major':
            commitMessage = `chore: release v${newVersion}\n\nBREAKING CHANGE: major version release`;
            break;
        case 'minor':
            commitMessage = `feat: release v${newVersion}`;
            break;
        case 'patch':
            commitMessage = `fix: release v${newVersion}`;
            break;
    }

    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
}

function showPreview(current, type) {
    const newVersion = calculateNewVersion(current, type);

    switch (type) {
        case 'major':
            console.log(`   ${current} → ${colors.GREEN}${newVersion}${colors.NC}`);
            console.log(`   ${colors.RED}⚠️  Breaking changes${colors.NC}`);
            break;
        case 'minor':
            console.log(`   ${current} → ${colors.GREEN}${newVersion}${colors.NC}`);
            console.log(`   ${colors.BLUE}✨ New features${colors.NC}`);
            break;
        case 'patch':
            console.log(`   ${current} → ${colors.GREEN}${newVersion}${colors.NC}`);
            console.log(`   ${colors.YELLOW}🐛 Bug fixes${colors.NC}`);
            break;
    }
}

function main() {
    printBanner();

    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
        printColor('❌ package.json not found!', colors.RED);
        process.exit(1);
    }

    // Check for uncommitted changes
    try {
        const gitStatus = execSync('git status --porcelain').toString().trim();
        if (gitStatus) {
            printColor('⚠️  You have uncommitted changes!', colors.YELLOW);
            console.log('');
            execSync('git status --short', { stdio: 'inherit' });
            console.log('');

            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            readline.question('Continue anyway? (y/n): ', (answer) => {
                readline.close();
                if (!answer.match(/^[Yy]$/)) {
                    process.exit(1);
                }
                continueProcess();
            });
        } else {
            continueProcess();
        }
    } catch (error) {
        printColor('❌ Git not available or not a git repository', colors.RED);
        process.exit(1);
    }

    function continueProcess() {
        const currentVersion = getCurrentVersion();
        printColor(`Current version: ${currentVersion}`, colors.GREEN);
        console.log('');

        printColor('Select version bump type:', colors.BLUE);
        console.log('');

        console.log(colors.PURPLE + '1) MAJOR version' + colors.NC);
        showPreview(currentVersion, 'major');
        console.log('');

        console.log(colors.BLUE + '2) MINOR version' + colors.NC);
        showPreview(currentVersion, 'minor');
        console.log('');

        console.log(colors.YELLOW + '3) PATCH version' + colors.NC);
        showPreview(currentVersion, 'patch');
        console.log('');

        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        function askChoice() {
            readline.question('Enter your choice (1-3): ', (choice) => {
                let versionType;
                switch (choice) {
                    case '1': versionType = 'major'; break;
                    case '2': versionType = 'minor'; break;
                    case '3': versionType = 'patch'; break;
                    default:
                        printColor('❌ Invalid choice. Please enter 1, 2, or 3.', colors.RED);
                        askChoice();
                        return;
                }

                readline.close();

                const newVersion = calculateNewVersion(currentVersion, versionType);

                console.log('');
                printColor(`Updating to version: ${newVersion}`, colors.CYAN);

                updatePackageVersion(newVersion);
                printColor('✅ package.json updated', colors.GREEN);

                printColor('Creating git commit and tag...', colors.BLUE);
                gitOperations(newVersion, versionType);
                printColor(`✅ Git tag v${newVersion} created`, colors.GREEN);

                console.log('');
                printColor('🎉 Version bump completed successfully!', colors.GREEN);
                console.log('');

                printColor('Next steps:', colors.CYAN);
                console.log('1) Push to git:    git push origin main --tags');
                console.log('2) Publish to npm: npm publish');
            });
        }

        askChoice();
    }
}

main();