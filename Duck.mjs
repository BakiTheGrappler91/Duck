#!/usr/bin/env node

import path from 'path';

// fs module helps access file system, create folders and files
import fs from 'fs/promises';

// node:crypto module provides cryptographic functionality that includes a set of wrappers for OpeenSSL's hash, HMAC, cipher, decipher, sign and verify functions
import crypto from 'crypto';

import chalk from 'chalk'

// NOTE: in future could write own diff algorithm.  import diff module for the time being.
import { diffLines } from 'diff';

// Commander module used to run program functions through a command-line interface like Bash.
import { Command } from 'commander';

const program = new Command(); // used to create and configure a new command for CLI program

class Duck {

    // Create constuctor for initialising an object instance of this class. Set paths and init
    constructor(repoPath = '.') {
        this.repoPath = path.join(repoPath, '.duck');
        this.objectsPath = path.join(this.repoPath, 'objects'); // .duck/objects - directory for storing the data for git objects
        this.headPath = path.join(this.repoPath, 'HEAD') // .duck/HEAD - file holding a reference to the branch you are currently on.  This tells Git what to use as the parent of next commit
        this.indexPath = path.join(this.repoPath, 'index'); // .duck/index - used as staging area between working directory and repository
        this.init();
    }

    // Create init method - create all folders for new project

    async init() {
        // Make a directory of objectsPath
        await fs.mkdir(this.objectsPath, {recursive: true}); // recursive: true - creates nested folders
        // Try-catch for creating HEAD file.  Pass the path, '' so file is empty, wx: open for writing, fail if file exists
        try {
            await fs.writeFile(this.headPath, '', {flag: 'wx'});
        // Index file initially contains empty array as nothing is staged yet
            await fs.writeFile(this.indexPath, JSON.stringify([]), {flag: 'wx'});
        } catch (error) {
            console.log("Already initialised the .duck folder") // if files already exist, no duplicates created
        }
    }

    hashObject(content) {
        return crypto.createHash('sha1').update(content, 'utf-8').digest('hex'); // Creates a new hash object that is capable of implementing the sha1 (secure hash algorithm 1). update method updates the hash content of the given data. digest calculates the final hash value in the form of a hexadecimal string
    }

    // Create add method - add files to the staging area

    async add(fileToBeAdded) {
        const fileData = await fs.readFile(fileToBeAdded, { encoding: 'utf-8'}); // asynchronously reads entire contents of file
        const fileHash = this.hashObject(fileData); // hash the file - encodes fileData using sha1
        console.log(fileHash); // display the hash of the file to be added
        const newFileHashedObjectPath = path.join(this.objectsPath, fileHash); // create new path using hash to store new file
        await fs.writeFile(newFileHashedObjectPath, fileData); // Write string(fileData) to file descriptor(newFileHashObjectPath)
        await this.updateStagingArea(fileToBeAdded, fileHash); // updates staging area
        console.log(`Added ${fileToBeAdded}`);
    }

    async updateStagingArea(filePath, fileHash) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' })); // read existing content in the index file
        index.push({ path: filePath, hash: fileHash }); // add the file to the index
        await fs.writeFile(this.indexPath, JSON.stringify(index)); // write the updated index file
    }

    // Create a commit method - commit files that exist in the staging area

    async commit(message) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' })); // read the index file
        const parentCommit = await this.getCurrentHead(); // gets current branch and most recent commit id

        const commitData = { // commitData object to store information about each commit
            timeStamp: new Date().toISOString(), // time commit was executed
            message, // message related to what was commited
            files: index, // files that exist in the staging area
            parent: parentCommit // hash of the previous commit
        };

        const commitHash = this.hashObject(JSON.stringify(commitData)); // get hash of data being commited
        const commitPath = path.join(this.objectsPath, commitHash); // get path where data is to be stored in objects
        await fs.writeFile(commitPath, JSON.stringify(commitData)); // write a file with commit data to commit path in objects
        await fs.writeFile(this.headPath, commitHash); // update the HEAD to point to the new commit
        await fs.writeFile(this.indexPath, JSON.stringify([])); // clear the staging area
        console.log(`Commit successfully created: ${commitHash}`);
    }

    async getCurrentHead() {
        try {
            return await fs.readFile(this.headPath, { encoding: 'utf-8'}); // return the contents of HEAD file - hash of previous commit
        } catch (error) {
            return null; // if nothing has been commited, return null
        }
    }

    // Create a log method - display all the commits in the repositories history

    async log() {
        let currentCommitHash = await this.getCurrentHead(); // variable for current commit hash
        while(currentCommitHash) { // loop through commits while currentCommitHash is not null.  loop ends when initial commit is reached as initial commit's parentCommit = null
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCommitHash), { encoding: 'utf-8'})); // read data in the objects folder using currentCommitHash
            console.log(`------------------------------\n`) // log a line to separate each commit
            console.log(`Commit: ${currentCommitHash}\nDate: 
                ${commitData.timeStamp}\n\n${commitData.message}\n\n`); // log the currentCommitHash, date of the commit and commit message
            currentCommitHash = commitData.parent; // update the current commit hash to the parent of the commit just logged (the previous commit)
        }        
    }

    // Create a diff method - display the changes between a commit and it's parent 

    async showCommitDiff(commitHash) {
        const commitData = JSON.parse(await this.getCommitData(commitHash)); // use commitHash to read desired commit data
        if(!commitData) { // if not commit data found, return message
            console.log("Commit not found");
            return;
        }
        console.log("Changes in the last commit are: ");

        for (const file of commitData.files) { // iterate through the files in commitData.files
            console.log(`File: ${file.path}`);  // log the file path
            const fileContent = await this.getFileContent(file.hash); // read file content
            console.log(fileContent); // log file content

            if(commitData.parent) { // if there exists a parent commit...       
                const parentCommitData = JSON.parse(await this.getCommitData(commitData.parent)); // get the parent commit data
                const getParentFileContent = await this.getParentFileContent(parentCommitData, file.path); // get the content from the parent commit files
                if(getParentFileContent !== undefined) { // if there is content...
                    console.log('\nDiff:');
                    const diff = diffLines(getParentFileContent, fileContent);  // variable stores the differences between parent files contents and current file contents using diffLines function

                    // console.log(diff);

                    diff.forEach(part => {
                        if(part.added) {
                            process.stdout.write(chalk.green("++" + part.value)); // highlight parts added in green preceeded by ++
                        } else if(part.removed) {
                            process.stdout.write(chalk.red("--" + part.value)); // highlight parts removed in red preceeded by --
                        } else {
                            process.stdout.write(chalk.grey(part.value));  // parts unchanged coloured grey
                        }
                    });
                    console.log(); // new line
                } else {
                    console.log("New file in this commit"); // log message to indicate a file does not exist in the parent commit and therefore must be a new file
                }

            } else {
                console.log("First commit"); // log message to indicate the commit has no parent and therefore must by the first commit
            }

        }
    }

    async getParentFileContent(parentCommitData, filePath) {
        const parentFile = parentCommitData.files.find(file => file.path === filePath);
        if(parentFile) {
            // get the file content from the parent commit and return the content
            return await this.getFileContent(parentFile.hash);
        }
    }

    async getCommitData(commitHash) {
        const commitPath = path.join(this.objectsPath, commitHash);
        try {
            return await fs.readFile(commitPath, { encoding: 'utf-8' });
        } catch (error) {
            console.log("Failed to read the commit data", error);
            return null;
        }
    }

    async getFileContent(fileHash) {
        const objectPath = path.join(this.objectsPath, fileHash);
        return fs.readFile(objectPath, { encoding: 'utf-8' });
    }

}

// (async () => {
//     const duck = new Duck();
//     // await duck.add('sample.txt');
//     // await duck.add('sample2.txt');
//     // await duck.commit('Second commit');
//     // await duck.log();
//     await duck.showCommitDiff('3e670e4e9ecc16928f1fd1b0a1ea1dbced0402c4')
// })();

// Create program commands so that functions can be executed through a command line interface

program.command('init').action(async () => {
    const duck = new Duck();
});

program.command('add <file>').action(async (file) => {
    const duck = new Duck();
    await duck.add(file);
});

program.command('commit <message>').action(async (message) => {
    const duck = new Duck();
    await duck.commit(message);
});

program.command('log').action(async () => {
    const duck = new Duck();
    await duck.log();
});

program.command('show <commitHash>').action(async (commitHash) => {
    const duck = new Duck();
    await duck.showCommitDiff(commitHash);
});

program.parse(process.argv); // processes the input from the user