

# Object fields

The object type is a field of fields. It returns a list of other fields, either statically or dynamically. Each field can also support remote options.

<div style={{ backgroundColor: "#fdf7f8", borderLeft: "4px solid #e03c54", padding: "16px 20px", margin: "24px 0", fontSize: "16px", color: "#e03c54" }}>
  ❗ Only available in the workflow builder. For sentence builder, use dynamic mapping instead.
</div>

# Reference

## Schema

The schema defines the subfields that make up your object.

### Static schema

Choose a static schema if the fields in your object will not change. You can configure each subfields in the developer center:

* **Subfield title:** Enter a unique name for the schema subfield.
* **Subfield key:** Enter a unique identifier for the schema subfield.
* **Choose primitive type:** Select one from the list.
* **Is array?**: Select whether or not it is an array.

<Image align="center" alt="Configuring the static schema with a &#x22;name&#x22; and &#x22;email&#x22; field" border={true} caption="Configuring the static schema with a &#x22;name&#x22; and &#x22;email&#x22; field" src="https://files.readme.io/2eb70bc7f50f78ac036addb9d251698e0fd155a16cf8fd49727d21f7e509a21a-SCR-20250306-mqvm.png" />

### Dynamic schema

With a dynamic schema, you can choose the fields at runtime. Choose this option if you want programatic control over your schema or rely on dependencies. You must add a schema URL that returns the list of fields to configure.

When the field is loaded, monday will send the schema URL a request, and the fields included in the response will be shown to the user.

The schema URL should return a JSON object. Each key is the unique key of the field, and the values are an object containing the field's title, type, primitiveType (if applicable), field key, and values for isNullable or isArray.

```json
{
  name: {
    title: "User name", // Label shown to the user
    type: "primitive", // Type - primitive or custom
    primitiveType: "string", // Used only for primitive fields - string, number, boolean, or date
    isNullable: false, // use true if the user can leave the field blank
    isArray: true // use true if user can choose multiple options
  },
  email: {
    title: "Email",
    type: "primitive",
    primitiveType: "string", 
    isNullable: false,
    isArray: false
  },
  transformationType: {
    title: "Logins",
    type: "custom",
    fieldTypeKey: "logins", // feature's unique key to reference custom fields
    isNullable: false,
    isArray: false
  }
}
```

```node
router.post('/fields/object', (req, res) => {
  res.send({
      name: {
        title: "User name",
        type: "primitive",
        primitiveType: "string",
        isNullable: false,
        isArray: true
      },
      email: {
        title: "Email",
        type: "primitive",
        primitiveType: "string",
        isNullable: false,
        isArray: false
      },
      transformationType: {
        title: "Logins",
        type: "custom",
        fieldTypeKey: "logins", // use the feature's unique key
        isNullable: false,
        isArray: false
      }
  })
})
```

# Dependencies

Your object can support mandatory and optional dependencies. These dependencies will be passed to your schema URL. Each dependency has a type and a field key.

<Image align="center" border={true} src="https://files.readme.io/5c61794ebdaf45ab84736d9ca9f1bd0f9d54b1a27ed1ea6c1e4a1eb910de93ec-image.png" className="border" />

<br />

# Sample request

The following request shows an object as an input field in [an action block](https://developer.monday.com/apps/docs/action-block-reference-workflows).

```json
{
  "payload": {
    "blockKind": "action",
    "credentialsValues":	{ 
       "credentials-key": { 
         userCredentialsId: 12345, 
         accessToken: "abc1234" 
       } 
     },
    "inboundFieldValues": {
      "object": {
        "email": "Hello world",
        "name": [
          "Dipro"
        ],
        "lastCall": "1993-08-27"
      }
    },
    "inputFields": {
      "object": {
        "email": "Hello world",
        "name": [
          "Dipro"
        ],
        "lastCall": "1993-08-27"
      }
    },
    "recipeId": 629186,
    "integrationId": 398515811
  },
  "runtimeMetadata": {
    "actionUuid": "6b68c693284f082e506361b1b5430955",
    "triggerUuid": "176d9c746aac92c59cce735b949daec5"
  }
}
```