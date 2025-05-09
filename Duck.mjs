import path from 'path';

// fs module helps access file system, create folders and files
import fs from 'fs/promises';

// node:crypto module provides cryptographic functionality that includes a set of wrappers for OpeenSSL's hash, HMAC, cipher, decipher, sign and verify functions
import crypto from 'crypto';

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

}

(async () => {
    const duck = new Duck();
    await duck.add('sample.txt');
    await duck.commit('Initial commit');
})();