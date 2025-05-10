import path from 'path';

// fs module helps access file system, create folders and files
import fs from 'fs/promises';

// node:crypto module provides cryptographic functionality that includes a set of wrappers for OpeenSSL's hash, HMAC, cipher, decipher, sign and verify functions
import crypto from 'crypto';

import chalk from 'chalk'

// NOTE: in future could write own diff algorithm.  import diff module for the time being.
import { diffLines } from 'diff';

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
        await fs.mkdir(this.objectsPath, {recursive: true});
        // Try-catch for creating HEAD file.  Pass the path, '' so file is empty, wx: open for writing, fail if file exists
        try {
            await fs.writeFile(this.headPath, '', {flag: 'wx'});
        // Index file initially contains empty array as nothing is staged yet
            await fs.writeFile(this.indexPath, JSON.stringify([]), {flag: 'wx'});
        } catch (error) {
            console.log("Already initialised the .duck folder")
        }
    }

    hashObject(content) {
        return crypto.createHash('sha1').update(content, 'utf-8').digest('hex'); // Creates a new hash object that is capable of implementing the sha1 (secure hash algorithm 1). update method updates the hash content of the given data. digest calculates the final hash value in the form of a hexadecimal string
    }

    // Create add method - add files to the staging area

    async add(fileToBeAdded) {
        const fileData = await fs.readFile(fileToBeAdded, { encoding: 'utf-8'}); // asynchronously reads entire contents of file
        const fileHash = this.hashObject(fileData); // hash the file - encodes fileData using sha1
        console.log(fileHash);
        const newFileHashedObjectPath = path.join(this.objectsPath, fileHash); // create new path using hash to store new file
        await fs.writeFile(newFileHashedObjectPath, fileData); // Write string(fileData) to file descriptor(newFileHashObjectPath)
        await this.updateStagingArea(fileToBeAdded, fileHash);
        console.log(`Added ${fileToBeAdded}`);
    }

    async updateStagingArea(filePath, fileHash) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' })); // read existing content in the index file
        index.push({ path: filePath, hash: fileHash }); // add the file to the index
        await fs.writeFile(this.indexPath, JSON.stringify(index)); // write the updated index file
    }

    async commit(message) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' })); // read the index file
        const parentCommit = await this.getCurrentHead();

        const commitData = {
            timeStamp: new Date().toISOString(),
            message,
            files: index,
            parent: parentCommit
        };

        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath, commitHash);
        await fs.writeFile(commitPath, JSON.stringify(commitData));
        await fs.writeFile(this.headPath, commitHash); // update the HEAD to point to the new commit
        await fs.writeFile(this.indexPath, JSON.stringify([])); // clear the staging area
        console.log(`Commit successfully created: ${commitHash}`);
    }

    async getCurrentHead() {
        try {
            return await fs.readFile(this.headPath, { encoding: 'utf-8'});
        } catch (error) {
            return null;
        }
    }

    async log() {
        let currentCommitHash = await this.getCurrentHead();
        while(currentCommitHash) {
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCommitHash), { encoding: 'utf-8'}));
            console.log(`------------------------------\n`)
            console.log(`Commit: ${currentCommitHash}\nDate:
                ${commitData.timeStamp}\n\n${commitData.message}\n\n`);
            currentCommitHash = commitData.parent;
        }        
    }

    async showCommitDiff(commitHash) {
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if(!commitData) {
            console.log("Commit not found");
            return;
        }
        console.log("Changes in the last commit are: ");

        for (const file of commitData.files) {
            console.log(`File: ${file.path}`);
            const fileContent = await this.getFileContent(file.hash);
            console.log(fileContent);

            if(commitData.parent) {
                // get the parent commit data
                const parentCommitData = JSON.parse(await this.getCommitData(commitData.parent));
                const getParentFileContent = await this.getParentFileContent(parentCommitData, file.path);
                if(getParentFileContent !== undefined) {
                    console.log('\nDiff:');
                    const diff = diffLines(getParentFileContent, fileContent);

                    console.log(diff);

                    diff.forEach(part => {
                        if(part.added) {
                            process.stdout.write(chalk.green(part.value));
                        } else if(part.removed) {
                            process.stdout.write(chalk.red(part.value));
                        } else {
                            process.stdout.write(chalk.grey(part.value));
                        }
                    });
                    console.log(); // new line
                } else {
                    console.log("New file in this commit");
                }

            } else {
                console.log("First commit");
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

(async () => {
    const duck = new Duck();
    // await duck.add('sample.txt');
    // await duck.commit('Third commit');
    // await duck.log();
    await duck.showCommitDiff('7b579ece30905daaf28a102c336789001e6146db')
})();
