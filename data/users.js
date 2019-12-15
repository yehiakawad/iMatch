const mongoCollections = require('../config/mongoCollections');
const users = mongoCollections.users;
const uuid = require('uuid/v4');
const bcrypt = require('bcrypt');

const saltRounds = 16;

module.exports = {
  // **** General functions ****
  // create new user when someone registers
  async create(username, password, firstname, lastname, email, phone, zipcode, latitude, longitude, availability) {
    // error check
    if(!username) throw 'Registration failed: username not provided';

    if(!password) throw 'Registration failed: password not provided';

    if(!firstname) throw 'Registration failed: firstname not provided';

    if(!lastname) throw 'Registration failed: lastname not provided';

    if(!email) throw 'Registration failed: email not provided';

    if(!phone) throw 'Registration failed: phone not provided';

    // Blank zip, latitude, or longitude
    if (zipcode == '' || latitude == '' || longitude == '') {
      throw "Registration failed: Invalid zip code";
    }

    // Blank availability should not be an error
    if(availability == null) 
    {
      availability = [];
    }

    // get users collection
    const usersCollection = await users();
    const userNameExists = await usersCollection.findOne({username: username});
    // check if username exists
    if(userNameExists)
    {
      throw 'Registration failed: Username already exists';
    }

    // hash password with bcrypt
    const hash = await bcrypt.hash(password, saltRounds);
    const userId = uuid();

    let newUser = {
      _id: userId,
      username: username,
      hashedPassword: hash,
      profile: {
        id: userId,
        firstname: firstname,
        lastname: lastname,
        email: email,
        phone: phone,
        zipcode: zipcode,
        latitude: latitude,
        longitude: longitude,
        grouped: 'false',
        title: "student",
        course: [],
        availability: availability,
        meetings: []
      },
      validSessionIDs: []
    };

    const insertInfo = await usersCollection.insertOne(newUser);
    if (insertInfo.insertedCount === 0) throw "failed to add new user";

    return await this.getUserById(insertInfo.insertedId);
  },

  // returns a list of all users in the database
  async getUsers() {
    // get users collection
    const usersCollection = await users();

    // empty query to omit any searching/filtering
    // find() operation returns dbCursor which is converted to data with toArray() 
    const allUsers = await usersCollection.find({}).toArray();
    if (!allUsers) throw "no users in database";
    return allUsers;
  },

  // returns user matching the given id
  async getUserById(id) {
    if (!id) throw "id not specified";

    const usersCollection = await users();
    // findOne() takes object representing query to perform
    const oneUser = await usersCollection.findOne({ _id: id });
    if (!oneUser) throw `failed to find user with id: ${id}`;

    return oneUser;
  },

  // returns an array of users by zip code
  async getUsersByZip(zipCode) {
    if (!zipCode) throw 'zip code not specified';

    const usersCollection = await users();
    const usersByZip = await usersCollection.find({ "profile.zipcode": zipCode }).toArray();

    if (!usersByZip) throw `failed to find user with zip: ${zipCode}`;

    return usersByZip;
  },
  
  // return a user document with matching userName
  async getUserByUsername(userName) {
    if (!userName) throw 'username not specified';
    
    const usersCollection = await users();
    const oneUser = await usersCollection.findOne({ username: userName });
    if (!oneUser) throw 'Failed to find user with that username';
    
    return oneUser;
  },

  // returns an array of users that have not been grouped
  async getUngroupedUsers() {
    const usersCollection = await users();
    const ungroupedUsers = await usersCollection.find({grouped: 'false'}).toArray();

    if(!ungroupedUsers){ ungroupedUsers = []; }

    return ungroupedUsers;
  },

  // returns an array of users by availability (day-of-the-week)
  async getUsersByDay(day) {
    if(!day) throw 'day not specified';

    const usersCollection = await users();
    const usersByDay = await usersCollection.find({"profile.availability": {$elemMatch: {$eq: day }}}).toArray();

    if(!usersByDay) throw `failed to find users with availability ${day}`;

    return usersByDay;
  },

  // returns an array of users by complete availability list
  async getUsersByAvailability(availabilityArr) {
    if(!availabilityArr) throw 'availability not specified';

    const usersCollection = await users();
    const usersByAvailability = await usersCollection.find({"profile.availability": {$all: availabilityArr}}).toArray();

    if(!usersByAvailability) 
    {
      return [];
    }

    return usersByAvailability;
  },

  // returns an array of users that have not been grouped
  async getUngroupedUsers() {
    const usersCollection = await users();
    const ungroupedUsers = await usersCollection.find({"profile.grouped": 'false'}).toArray();

    if(!ungroupedUsers){ ungroupedUsers = []; }

    return ungroupedUsers;

  },

  // remove user with the given id from database
  async remove(id) {
    if (!id) throw "id not specified";

    const usersCollection = await users();
    const userQuery = await this.getUserById(id);

    const removalInfo = await usersCollection.removeOne({ _id: id });
    if (removalInfo.deletedCount === 0) throw `failed to remove user with id: ${id}`;

    let removedUser = {
      deleted: true,
      data: userQuery
    }

    return removedUser;
  },

  // update user profile info
  async updateUser(id, firstname, lastname, email, phone, zipcode) {
    if (!id) throw "id not specified";

    const usersCollection = await users();
    const userQuery = await this.getUserById(id);

    let newFirstname = userQuery.profile.firstname;
    let newLastname = userQuery.profile.lastname;
    let newEmail = userQuery.profile.email;
    let newPhone = userQuery.profile.phone;
    let newZipcode = userQuery.profile.zipcode;

    if (firstname) newFirstname = firstname;
    if (lastname) newLastname = lastname;
    if (email) newEmail = email;
    if (phone) newPhone = phone;
    if (zipcode) newZipcode = zipcode;

    const updateQuery = {
      $set: {
        profile: {
          id: id,
          firstname: newFirstname,
          lastname: newLastname,
          email: newEmail,
          phone: newPhone,
          zipcode: newZipcode,
          latitude: userQuery.profile.latitude,
          longitude: userQuery.profile.longitude,
          grouped: userQuery.profile.grouped,
          title: userQuery.profile.title,
          course: userQuery.profile.course,
          availability: userQuery.profile.availability,
          meetings: userQuery.profile.meetings
        }
      }
    };

    const updateInfo = await usersCollection.updateOne(userQuery, updateQuery);
    if (updateInfo.modifiedCount === 0) {
      throw `failed to update user with id: ${id}`;
    } else {
      console.log("success");
      return "Successfully updated profile";
    }
  },

  // adds a course to user, called via update schedule form
  async addCourseToUser(id, courseId) {
    if (!id) throw "id not specified";

    const usersCollection = await users();
    const userQuery = await this.getUserById(id);
    const updatedQuery = {
      $addToSet: { course: courseId }
    };

    const updateInfo = await usersCollection.updateOne(userQuery, updatedQuery);
    if (updateInfo.modifiedCount === 0) throw `failed to update course to user with id: ${id}`;
    else {
      return "Successfully updated profile with new course";
    }
  },

  // removes a course from user, called via update schedule form
  async removeCourseFromUser(id, courseId) {
    if (!id) throw "id not specified";

    const usersCollection = await users();
    const userQuery = await this.getUserById(id);
    const removeQuery = {
      $pull: { course: courseId }
    };

    const updateInfo = await usersCollection.updateOne(userQuery, removeQuery);
    if (updateInfo.modifiedCount === 0) throw `failed to remove course to user with id: ${id}`;
    else {
      return "Successfully removed course from profile with id";
    }
  },

  // add availability to user, called via update schedule form
  async addAvailabilityToUser(id, availDay) {
    if (!id) throw "id not specified";

    const usersCollection = await users();
    const userQuery = await this.getUserById(id);
    const updatedQuery = {
      $addToSet: { availability: availDay }
    };

    const updateInfo = await usersCollection.updateOne(userQuery, updatedQuery);
    if (updateInfo.modifiedCount === 0) throw `failed to update availability for user with id: ${id}`;
    else {
      return "Successfully updated profile with new availability";
    }
  },

  // removes availability from user, called via update schedule form
  async updateAvailability(id, availDay) {
    if (!id) throw "id not specified";

    const usersCollection = await users();
    const userQuery = await this.getUserById(id);
    const updatedQuery = {
      $pull: { availability: availDay }
    };

    const updateInfo = await usersCollection.updateOne(userQuery, updatedQuery);
    if (updateInfo.modifiedCount === 0) throw `failed to update availability for user with id: ${id}`;
    else {
      return "Successfully updated profile with new availability";
    }
  },

  // update a user's grouped status
  async updateUserGroupedStatus(id) {
      if(!id) throw 'id not specified';

      const usersCollection = await users();
      const userQuery = await this.getUserById(id);
      const updateInfo = {'profile.grouped': "true"};
      const updateUser = await usersCollection.updateOne(userQuery, updateInfo);

      if(updateUser.modifiedCount === 0) throw 'failed to update users grouped status';

      else {
        return await this.getUserById(id);
      }
  },

  // adds a meeting to user, this will be called after algorithm matches a group
  // and finds a common meeting time/place
  async addMeetingToUser(userId, meetingId, meetingTitle) {

  },

  // removes a meeting from user, this will be called after user removes a course
  async removeMeetingFromUser(userId, meetingId) {

  },

  // **** Security-related functions ****
  // verify username and password using bcrypt when logging in
  async verifyUser(userName, password,sessionID) {
    //search for user with username in db
    const oneUser = await this.getUserByUsername(userName);
    
    //check if passwords are the same
    let samePass = await bcrypt.compare(password, oneUser.hashedPassword);
    if (samePass) {
      //update validSessionIDs array of user in the db
      let newValidSessionIDs = oneUser.validSessionIDs;
      newValidSessionIDs.push(sessionID);
      
      let updatedUser = {
        validSessionIDs: newValidSessionIDs
      };
      
      const usersCollection = await users();
      const updatedInfo = await usersCollection.updateOne({username: userName}, {$set:updatedUser});
      if (updatedInfo.modifiedCount === 0) {
        throw "Could not add sessionID to user document"
      };  
      return true;
    } else {
      return false;
    }

  },

  async addSessionToUser(username, sessionId) {

  },

  async removeSessionFromUser(sessionId) {

  },

  async getUserBySessionId(sessionId) {

  },

  // **** Sorting functions ****
  
  // sorts any users who are not part of a group by day of the
  // week availability
  async sortStudentsByDay() {

      // Get all un-grouped users
      const unGroupedUsers = await this.getUngroupedUsers();

      // Get the aggregate of unique availabilities
      const avalabilities = await this.aggregateByAvailability();

      let availabilityMap = {};
      for(i = 0; i < avalabilities.length; i++)
      {
          let key = avalabilities[i]._id;
          let value = await this.getUsersByAvailability(key);
          availabilityMap[key] = value;
      }

      return availabilityMap;
  },

  // Aggregates the users collection by availability
  async aggregateByAvailability() {

      const usersCollection = await users();

      const usersGroupedByDay = await usersCollection.aggregate([
          {$match: {"profile.grouped" : "false"}},
          {$group: {_id: "$profile.availability"}}
        ]).toArray();

      if(!usersGroupedByDay)
      {
        throw 'unable to group users by availability';
      }

      return usersGroupedByDay;
  },

  // Aggregates the users collection by zip code
  async aggregateByZipcode() {

      const usersCollection = await users();

      const usersGroupedByZip = await usersCollection.aggregate([
          {$match: {"profile.grouped" : "false"}},
          {$group: {_id: "$profile.zipcode"}}
        ]).toArray();

      if(!usersGroupedByZip)
      {
        throw 'unable to group users by zip code';
      }

      return usersGroupedByZip;
  }
}
