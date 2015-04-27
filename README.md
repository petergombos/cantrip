#cantrip
---

[![build status](https://api.travis-ci.org/kriekapps/cantrip.svg?branch=master)](http://travis-ci.org/KriekApps/Cantrip)

Cantrip is a databaseless storage middleware for express, it maps your requests automagically to any node in a given JSON document(json file) with basic CURD HTTP requests (GET, POST, PATCH, PUT, DELETE) over a RESTful API.

## Installation

```bash
$ npm install --save cantrip
```

## Getting Started

```js
var express = require('express');
var cantrip = require('cantrip');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.json());
app.use(function(err, req, res, next) {
	return next({
		status: 400,
		error: "Invalid JSON supplied in request body."
	});
});

app.use(cantrip({
	idAttribute: "id"
}));

app.use(function(req, res, next) {
	res.send(res.body);
});

app.use(function(error, req, res, next) {
	res.status(error.status).send(error);
});

app.listen(3000);
```

## Examples
### GET
Here is a sample cantrip instance, let's GET whats inside of it:
```bash
curl http://cantrip.kriekapps.com/randomID
```

Returns:
```json
{}
```
- You will get back the whole JSON file if you request the root.
- If you request a single property, the result will be an object like {"value": "foo"}
- You can request objects inside a collection by either putting their index or their id attribute in the url. 

There are a number of GET params you can use to target your request more specifically:
- *?shallow=true* Return only the first layer of keys, not nested objects. Objects will have the value "[object Object]", arrays will have "[object Array]".
- *?q=searchstring* Search in an array. If the value is a simple string, it will return all objects with any value (on the first layer) containing the given string. If it is a JSON object, matches only items where their specific properties include the given value.
- *?orderby=key* Order the results in an array by the given key. If the key is prepended by a minus sign, the order will be descending instead of ascending
- *?offset=10* Offset the results by 10 items
- *?limit=10* Only return 10 items
- *?fields=field1,field2* Return only the given fields, separated by commas


### PUT
Lets PUT some data into the datastore:
```bash
curl \
    -X PUT \
    -H "Content-type:application/json" \
    -d '{"cantrip":"rocks"}' \
    "http://cantrip.kriekapps.com/randomID"
```
- You can only put an object, not an array
- It will overwrite the target object with the one you specify

### PATCH
Now lets create a basic collection for our todo list, it is super easy with cantrip you can just PATCH the root object to create an array like so:
```bash
curl \
    -X PATCH \
    -H "Content-type:application/json" \
    -d '{"todos":[]}' \
    "http://cantrip.kriekapps.com/randomID"
```
- You can only patch an object, not an array
- It will overwrite only the properties you specified
- Will update the object's _modifiedDate property
- Deep merges multi-level objects

### POST
And now we can just POST any data into our freshly created collection:
```bash
curl \
    -X POST \
    -H "Content-type:application/json" \
    -d '{"title":"Buy some milk", "comlated":false}' \
    "http://cantrip.kriekapps.com/randomID/todos"
```

Returns:
```json
{
    "_createdDate":1430139024629,
    "_modifiedDate":1430139024629,
    "_id":"778b81e247f7d2ae38732ccf0087e2207c71f623",
    "title":"Buy some milk",
    "complated" : false
}
```
- You can only post to arrays
- Your object will automatically get a unique _id, a _createdDate and a _modifiedDate property, unless you specify them yourself. The latter two use JS timestamps.
- Won't let you post if the given _id already exists in that collection.

Since cantrip maps your data to a RESTful API now you can GET the newly inserted document on the following url by it's index:
```bash
curl http://cantrip.kriekapps.com/randomID/todos/0
```
or by it's id:
```bash
curl http://cantrip.kriekapps.com/randomID/todos/778b81e247f7d2ae38732ccf0087e2207c71f623
```

So have our milk and now would like to PATCH our todo object to be compleated, all we have to do is:

```bash
curl \
    -X PATCH \
    -H "Content-type:application/json" \
    -d '{"complated":true}' \
    "http://cantrip.kriekapps.com/randomID/todos/0"
```


### DELETE
Nice, but still in my collection, let's DELETE it, shall we?
```bash
curl \
    -X DELETE \
    -H "Content-type:application/json" \
    "http://cantrip.kriekapps.com/randomID/todos/0"
```
- Deletes the target key from its parent object, or deletes an item from an array
- Won't let you delete an object's _id or other metadata like _createdDate or _modifiedDate

## Options

You can specify a number of options when calling the cantrip() function to generate a middleware.
* file: Path to the JSON file you wish to use. Defaults to a newly created data.json file.
* idAttribute: Specifies what key should act as the id of objects. Defaults to _id.
* saveFrequency: Specifies how many non-GET requests does it take to trigger a saving of data state to the file. Defaults to 1, meaning it will save on every request. If you specify 0, it will never save.
* shallow: Similar to the GET parameter, but specified as an option when creating the cantrip instance means all GET requests will be shallow.

## License

  [MIT](LICENSE)