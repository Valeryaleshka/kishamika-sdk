#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';
import prompts from 'prompts';

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

function publishToNpm() {
    try {
        printColor('📦 Publishing to npm...', colors.BLUE);
        execSync('npm publish', { stdio: 'inherit' });
        printColor('✅ Successfully published to npm!', colors.GREEN);
        return true;
    } catch (error) {
        printColor('❌ Failed to publish to npm', colors.RED);
        return false;
    }
}

function isLoggedInToNpm() {
    try {
        execSync('npm whoami', { stdio: 'pipe' });
        return true;
    } catch (error) {
        return false;
    }
}

async function main() {
    printBanner();

    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
        printColor('❌ package.json not found!', colors.RED);
        process.exit(1);
    }

    // Check npm login status
    if (!isLoggedInToNpm()) {
        printColor('❌ You are not logged in to npm!', colors.RED);
        printColor('Run: npm login', colors.YELLOW);
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

            const proceed = await prompts({
                type: 'confirm',
                name: 'value',
                message: 'Continue anyway?',
                initial: false
            });

            if (!proceed.value) {
                process.exit(1);
            }
        }
    } catch (error) {
        printColor('❌ Git not available or not a git repository', colors.RED);
        process.exit(1);
    }

    const currentVersion = getCurrentVersion();
    printColor(`Current version: ${currentVersion}`, colors.GREEN);
    console.log('');

    // Version selection with arrow keys
    const versionResponse = await prompts({
        type: 'select',
        name: 'versionType',
        message: 'Select version bump type:',
        choices: [
            {
                title: `${colors.PURPLE}MAJOR${colors.NC} (breaking changes)    ${currentVersion} → ${calculateNewVersion(currentVersion, 'major')}`,
                description: `${colors.RED}Breaking changes${colors.NC}`,
                value: 'major'
            },
            {
                title: `${colors.BLUE}MINOR${colors.NC} (new features)       ${currentVersion} → ${calculateNewVersion(currentVersion, 'minor')}`,
                description: `${colors.BLUE}New features${colors.NC}`,
                value: 'minor'
            },
            {
                title: `${colors.YELLOW}PATCH${colors.NC} (bug fixes)         ${currentVersion} → ${calculateNewVersion(currentVersion, 'patch')}`,
                description: `${colors.YELLOW}Bug fixes${colors.NC}`,
                value: 'patch'
            }
        ],
        initial: 2
    });

    if (!versionResponse.versionType) {
        printColor('❌ Version selection cancelled', colors.RED);
        process.exit(1);
    }

    const newVersion = calculateNewVersion(currentVersion, versionResponse.versionType);

    console.log('');
    printColor(`Updating to version: ${newVersion}`, colors.CYAN);

    updatePackageVersion(newVersion);
    printColor('✅ package.json updated', colors.GREEN);

    printColor('Creating git commit and tag...', colors.BLUE);
    gitOperations(newVersion, versionResponse.versionType);
    printColor(`✅ Git tag v${newVersion} created`, colors.GREEN);

    // Ask for publishing options
    const publishResponse = await prompts({
        type: 'select',
        name: 'action',
        message: 'Select publishing action:',
        choices: [
            {
                title: `${colors.GREEN}Publish to npm and push to git${colors.NC}`,
                description: 'Full automated release',
                value: 'publish-and-push'
            },
            {
                title: `${colors.BLUE}Push to git only${colors.NC}`,
                description: 'Skip npm publishing',
                value: 'push-only'
            },
            {
                title: `${colors.YELLOW}Skip both${colors.NC}`,
                description: 'Manual publishing later',
                value: 'skip'
            }
        ],
        initial: 0
    });

    let publishedToNpm = false;
    let pushedToGit = false;

    switch (publishResponse.action) {
        case 'publish-and-push':
            // Publish to npm
            publishedToNpm = publishToNpm();

            // Push to git
            printColor('🚀 Pushing to git...', colors.BLUE);
            execSync('git push origin main --tags', { stdio: 'inherit' });
            pushedToGit = true;
            printColor('✅ Pushed to git repository', colors.GREEN);
            break;

        case 'push-only':
            // Push to git only
            printColor('🚀 Pushing to git...', colors.BLUE);
            execSync('git push origin main --tags', { stdio: 'inherit' });
            pushedToGit = true;
            printColor('✅ Pushed to git repository', colors.GREEN);
            break;

        case 'skip':
            printColor('⏭️  Skipping publishing', colors.YELLOW);
            break;
    }

    console.log('');
    printColor('🎉 Release completed successfully!', colors.GREEN);
    console.log('');

    // Summary
    printColor('Release Summary:', colors.CYAN);
    console.log(`📦 Version: ${newVersion}`);
    console.log(`🔖 Git Tag: v${newVersion}`);
    console.log(`📚 NPM: ${publishedToNpm ? '✅ Published' : '⏭️  Skipped'}`);
    console.log(`🐙 Git: ${pushedToGit ? '✅ Pushed' : '⏭️  Skipped'}`);
    console.log('');

    if (!publishedToNpm) {
        printColor('To publish manually later:', colors.YELLOW);
        console.log('npm publish');
    }

    if (!pushedToGit) {
        printColor('To push manually later:', colors.YELLOW);
        console.log('git push origin main --tags');
    }
}

main().catch(console.error);