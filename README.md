#cantrip

[![build status](https://api.travis-ci.org/kriekapps/cantrip.svg?branch=master)](https://travis-ci.org/kriekapps/cantrip)

Cantrip is a simple express middleware that maps REST API calls to their matching nodes inside any JSON document. It's super fast to set up, but can also handle more complex tasks since it works well with other parts of your application. We use it all the time for small projects, weekend hacking and quick prototyping.

## Installation

```bash
$ npm install cantrip
```

## Getting Started

```js
var express = require('express');
var cantrip = require('cantrip')({
    file: "data/data.json"
});
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.json());
app.use(function(err, req, res, next) {
	return next({
		status: 400,
		error: "Invalid JSON supplied in request body."
	});
});

app.use(cantrip);

app.use(function(req, res, next) {
	res.send(res.body);
});

app.use(function(error, req, res, next) {
	res.status(error.status).send(error);
});

app.listen(3000);
```

You can use cantrip on all requests or just a single route, your choice. It works just like any other middleware. After called, it will do any data manipulation it is supposed to (and able to) do, then write return data on res.body, so make sure you send that to the user! If there happen to be any errors along the way, like trying to access a route that doesn't exist, cantrip will call next() with an error object, that has suggested status and message fields. Handle it the way you want to!

## Examples
### GET
Here the cantrip server runs on the *randomID* path of the API, so sending a GET request to the following URL will return the root of our JSON object:
```bash
$ curl "https://cantrip.kriek.io/randomID/"
```

And sure enough, it returns an empty object. Of course we could have initialized it with any JSON data. In that case, this request would have returned the whole JSON object.
```json
{}
```
Things to remember:

- You will get back the whole JSON file if you request the root.
- If you request a single property, the result will be wrapped in an object like this: *{"value": "foo"}*.
- You can request objects inside a collection by putting their id attribute in the url. For example: requesting */articles/e155662caaf5be046a0f0a61930c4b4e917f0ea8* will return the article with the given ID.
- Trying to get a non-existent path will result in an error.

There are a number of GET params you can use to target your request more specifically:

* *?shallow=true* Return only the first layer of keys, not nested objects. Objects will have the value "[object Object]", arrays will have "[object Array]".
* *?q=searchstring* Search in an array. If the value is a simple string, it will return all objects with any value (on the first layer) containing the given string. If it is a JSON object, matches only items where their specific properties include the given value.
* *?orderby=key* Order the results in an array by the given key. If the key is prefixed by a minus sign, the order will be descending instead of ascending
* *?offset=10* Offset the results by *n* items
* *?limit=10* Only return *n* items
* *?fields=field1,field2* Return only the given fields, separated by commas


### PUT
The PUT method is used to overwrite values. To modify the keys of an object, send a PUT request to that object, along with the data you wish to set to it. In this example, we will be overwriting our empty root object.
```bash
$ curl \
    -X PUT \
    -H "Content-type:application/json" \
    -d '{"foo":"bar"}' \
    "https://cantrip.kriek.io/randomID/"
```
- You can only PUT an object, not an array
- It will overwrite the target object with the one you specify in the request body.

### PATCH
PATCH is used when you want to modify an object, but don't want to overwrite it completely. The keys you send will replace existing ones or append themselves to the object (basically merging the two together) and leave the rest alone. Let's create a basic collection for a todo list, once again on the root object.
```bash
$ curl \
    -X PATCH \
    -H "Content-type:application/json" \
    -d '{"todos":[]}' \
    "https://cantrip.kriek.io/randomID/"
```
Note that the key *cantrip* is still present, since we didn't specify any modifications to it. Keep in mind, that:

- You can only PATCH an object, not an array
- It will overwrite only the properties you specified
- Will update the object's _modifiedDate property, if it has one
- Deep merges multi-level objects

### POST
Arrays rarely contain basic data types. Most of the time you will be populating them by sending a POST request to their URL. This will insert the object in your request body to the end of the array, as well as making sure it has a unique id, a creation and last modification dates. Let's make a single to-do item and send it to our previously created collection:
```bash
$ curl \
    -X POST \
    -H "Content-type:application/json" \
    -d '{"title":"Buy milk", "completed":false}' \
    "https://cantrip.kriek.io/randomID/todos"
```

Returns:
```json
{
    "_createdDate":1430139024629,
    "_modifiedDate":1430139024629,
    "_id":"some-randomly-generated-id",
    "title":"Buy milk",
    "completed" : false
}
```
- You can only POST to arrays
- Your object will automatically get a unique _id, a _createdDate and a _modifiedDate property, unless you specify them yourself. The latter two use JS timestamps.
- Sends back an error if you specified an _id yourself and that _id already exists in the collection.

As mentioned before, you can link to this object by using its unique id:
```bash
$ curl "https://cantrip.kriek.io/randomID/todos/some-randomly-generated-id"
```

So we have our to-do now, and we would like to switch it to completed. This can be accomplished with a PATCH request:

```bash
$ curl \
    -X PATCH \
    -H "Content-type:application/json" \
    -d '{"completed":true}' \
    "https://cantrip.kriek.io/randomID/todos/some-randomly-generated-id"
```


### DELETE
DELETE requests can be used to delete a key from an object or an item from a collection, though in many cases you can achieve the same thing using PUT requests on the parent object. Deleting the previously inserted to-do item looks like this:
```bash
$ curl \
    -X DELETE \
    -H "Content-type:application/json" \
    "https://cantrip.kriek.io/randomID/todos/some-randomly-generated-id"
```
- Deletes the target key from its parent object, or deletes an item from an array

## Options

You can specify a number of options when calling the cantrip() function to generate a middleware.

* file: Path to the JSON file you wish to use. Defaults to a newly created and empty data.json file.
* idAttribute: Specifies what key should act as the id of objects. Defaults to _id.
* saveFrequency: Specifies how many non-GET requests does it take to trigger a saving of data state to the file. Defaults to 1, meaning it will save on every request. If you specify 0, it will never save.
* shallow: Similar to the GET parameter of the same name, but when specified as an option during the creation of the cantrip instance means that all GET requests will be shallow.
* indexing: You can allow in-memory indexing of arrays by the item ids. It's turned off by default, but if you have large datasets, you might want to turn it on, otherwise looking up objects will take a bit more time, since it iterates through the whole array. The first request will be a bit longer though, because that's when it builds up the index hash.

## Accessing the data without a request
The cantrip instance returned by the factory function is not only a middleware, but has some accessor methods for the actual data. Use these whenever you need to access or modify the data directly on the server. These functions are synchronious, and their first parameter is a URI string that matches the endpoint you are trying to access. On error a null value will be returned.

```js
app.get("/users/:id", function(req, res, next) {
   //Attach all posts by the user to the response
   var posts = cantrip.get("/posts");
   res.body.posts = _.filter(posts, function(post) {
        return post.author === req.params.id;
   });
   next();
});
```

The delete method is very similar. However, there are no POST, PUT or PATCH methods, only a *set* action, that takes a second argument, which defines the data you wish to save. The third parameter signifies whether you want to use a PUT (false) or PATCH (true) -like method.

```js
app.post("/articles", function(req, res, next) {
   //Add the article to the list of articles by the user
   cantrip.set("/users/" + req.user.id + "/articles", { title: req.body.title });
   next();
});
```

## Who is it for?
It's mainly aimed towards small projects and weekend hacking. Note that it's not finished yet and is not at all scalable.

## License

  [MIT](LICENSE)
