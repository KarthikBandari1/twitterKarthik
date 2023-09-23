const express = require("express");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http:/localhost:3000/");
    });
  } catch (e) {
    console.log(e.message);
  }
};

initializeDBAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log(payload.username);
        request.username = payload.username;
        next();
      }
    });
  }
}

//Registering (api 1)
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (password.length >= 6 && dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        );`;
    const dbResponse = await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else if (password.length < 6 && dbUser === undefined) {
    response.status(400);
    response.send(`Password is too short`);
  } else {
    response.status(400);
    response.send(`User already exists`);
  }
});

//login(api 2)
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      request.username = payload.username;
      console.log(payload.username);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//api 3(return 4 latest tweets)
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getUserIdQuery = `
SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  LoggedUserId = getUserId.user_id;

  const tweetsQuery = `
  SELECT T.username as username,tweet, date_time as dateTime from (user inner join follower on user.user_id=follower.following_user_id) as T inner join tweet on T.following_user_id=tweet.user_id where follower.follower_user_id='${LoggedUserId}' order by dateTime DESC limit 4;`;
  const getTweets = await db.all(tweetsQuery);
  response.send(getTweets);
});

//api 4 (following usernames)
app.get("/user/following/", authenticateToken, async (request, response) => {
  const getUserIdQuery = `
SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  LoggedUserId = getUserId.user_id;

  const userNamesQuery = `
  SELECT user.name as name from user inner join follower on user.user_id=follower.following_user_id where follower.follower_user_id='${LoggedUserId}'; `;
  const getNames = await db.all(userNamesQuery);
  response.send(getNames);
});

//api 5 (following usernames)
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getUserIdQuery = `
SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  LoggedUserId = getUserId.user_id;
  const userNamesQuery = `
  SELECT user.name as name from user inner join follower on user.user_id=follower.follower_user_id where follower.following_user_id='${LoggedUserId}'; `;
  const getNames = await db.all(userNamesQuery);
  response.send(getNames);
});

//api 6 (specific tweet)
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const getUserIdQuery = `
SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  LoggedUserId = getUserId.user_id;

  const followingUserIdsQuery = `
  SELECT following_user_id as user_id from follower where follower_user_id='${LoggedUserId}'`;
  const followingUserIds = await db.all(followingUserIdsQuery);
  const userIdOfTweetQuery = `
  SELECT user_id from tweet where tweet_id='${tweetId}';`;
  const userIdOfTweet = await db.get(userIdOfTweetQuery);
  let allowed = false;
  followingUserIds.forEach((each) => {
    if (each.user_id === userIdOfTweet.user_id) {
      allowed = true;
    }
  });
  if (allowed) {
    const resultQuery = `select
     tweet,
     (select count(like_id) from like where tweet_id=${tweetId}) as likes,
          (select count(reply_id) from reply where tweet_id=${tweetId}) as replies,
     date_time as dateTime from tweet where tweet_id=${tweetId};
    `;
    const result = await db.get(resultQuery);
    response.send(result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//api-7 getting likes
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getUserIdQuery = `
SELECT user_id from user where username='${request.username}';`;
    const getUserId = await db.get(getUserIdQuery);
    LoggedUserId = getUserId.user_id;

    const followingUserIdsQuery = `
  SELECT following_user_id as user_id from follower where follower_user_id='${LoggedUserId}'`;
    const followingUserIds = await db.all(followingUserIdsQuery);
    const userIdOfTweetQuery = `
  SELECT user_id from tweet where tweet_id='${tweetId}';`;
    const userIdOfTweet = await db.get(userIdOfTweetQuery);
    let allowed = false;
    followingUserIds.forEach((each) => {
      if (each.user_id === userIdOfTweet.user_id) {
        allowed = true;
      }
    });
    if (allowed) {
      const resultQuery = `
    select username from like inner join user on like.user_id=user.user_id where tweet_id='${tweetId}' `;
      const result = await db.all(resultQuery);
      let userNameList = [];
      result.forEach((each) => {
        userNameList.push(each.username);
      });
      const final = {
        likes: userNameList,
      };
      response.send(final);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api-8 getting replies
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getUserIdQuery = `
SELECT user_id from user where username='${request.username}';`;
    const getUserId = await db.get(getUserIdQuery);
    LoggedUserId = getUserId.user_id;

    const followingUserIdsQuery = `
  SELECT following_user_id as user_id from follower where follower_user_id='${LoggedUserId}'`;
    const followingUserIds = await db.all(followingUserIdsQuery);
    const userIdOfTweetQuery = `
  SELECT user_id from tweet where tweet_id='${tweetId}';`;
    const userIdOfTweet = await db.get(userIdOfTweetQuery);
    let allowed = false;
    followingUserIds.forEach((each) => {
      if (each.user_id === userIdOfTweet.user_id) {
        allowed = true;
      }
    });
    if (allowed) {
      const resultQuery = `
    select name,reply from reply inner join user on reply.user_id=user.user_id where tweet_id='${tweetId}' `;
      const result = await db.all(resultQuery);

      const final = {
        replies: result,
      };
      response.send(final);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//list of all tweets of the user
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const getUserIdQuery = `
SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  LoggedUserId = getUserId.user_id;
  const tweetsQuery = `
  select tweet,count(like_id) as likes,count(reply_id) as replies
  ,tweet.date_time as dateTime from (tweet left join like on tweet.tweet_id=like.tweet_id) as T
  left join reply on T.tweet_id=reply.tweet_id where tweet.user_id=${LoggedUserId} group by tweet;`;
  const getTweets = await db.all(tweetsQuery);
  response.send(getTweets);
});

//create
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const time = new Date();
  const getUserIdQuery = `
SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  LoggedUserId = getUserId.user_id;

  const postTweetQuery = `
  INSERT INTO
    tweet (tweet,user_id,date_time)
  VALUES
    ('${tweet}', '${LoggedUserId}', '${time}');`;
  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

//delete
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getUserIdQuery = `
    SELECT user_id from user where username='${request.username}';`;
    const getUserId = await db.get(getUserIdQuery);
    LoggedUserId = getUserId.user_id;
    console.log(LoggedUserId);

    const followingUserIdsQuery = `
  SELECT following_user_id as user_id from follower where follower_user_id='${LoggedUserId}'`;
    const followingUserIds = await db.all(followingUserIdsQuery);
    const userIdOfTweetQuery = `
  SELECT user_id from tweet where tweet_id='${tweetId}';`;
    const userIdOfTweet = await db.get(userIdOfTweetQuery);
    let allowed = false;
    followingUserIds.forEach((each) => {
      if (each.user_id === userIdOfTweet.user_id) {
        allowed = true;
      }
    });
    if (allowed) {
      const deleteTweetQuery = `
  DELETE FROM
    tweet
  WHERE
    tweet_id = '${tweetId}';
  `;
      await db.run(deleteTweetQuery);
      response.send(`Tweet Removed`);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
