

# monday workflows

Technical documentation for users building integrations for the monday.com ecosystem

Blocks are the basic unit of workflow automation in monday.com. In this section, you'll find reference documentation for building blocks and fields for monday workflows.

Skip to **[About monday workflows](https://developer.monday.com/apps/docs/workflow-builder#about-monday-workflows)**  to learn the basics of monday workflows.

<HTMLBlock>
  {`
  <style>
    .container {
      display: flex;
      gap: 16px;
      justify-content: center;
      align-items: center;
      width: 100%;
      flex-direction: column;
    }

    .row {
      flex-flow: row wrap;
      gap: 16px;
      width: 100%;

    }

    .card {
      display: flex;
      justify-content: start;
      align-items: center;
      box-sizing: border-box;
      flex-direction: column;
      background-color: #ffffff;
      border: solid 1px;
      border-color: #d0d4e4;
      border-radius: 8px;
    }

    .textWrapper {
      padding: 16px 20px 24px 20px;
      flex-grow: 1;
    }

    .textWrapper>h2 {
      font-weight: 700;
      margin-top: 4px;
      margin-bottom: 4px;
      font-size: 20px;
    }

    .row>a[href] {
      text-decoration: none;
      color: inherit;
      min-width: 150px;
      max-width: 30%;
      @media (width < 600px) {
        max-width: calc(50% - 16px);
      }
      @media (width < 468px) {
        max-width: calc(100% - 16px);
      }
    }

    a:hover {
      box-shadow: 0px 6px 20px rgba(0, 0, 0, 0.2);
      text-decoration: none;
      border-radius: 8px;
    }
  </style>
  <div class="container">
    <div class="row">
      <a href="https://developer.monday.com/apps/docs/build-a-workflow-block" class="card">
        <div class="textWrapper">
          <h2>Create your first block</h2>
          <p>A guide for creating a block in the monday UI.</p>
        </div>
      </a>
      <a href="https://developer.monday.com/apps/docs/create-your-blocks-fields" class="card">
        <div class="textWrapper">
          <h2>Add a custom field</h2>
          <p>A guide to create a custom field and configure its dependencies.</p>
        </div>
      </a>
      <a href="https://developer.monday.com/apps/docs/test-your-blocks-and-fields" class="card">
        <div class="textWrapper">
          <h2>Test your blocks</h2>
          <p>A guide to use your blocks in your development environment.</p>
        </div>
      </a>
      <a href="https://developer.monday.com/apps/docs/action-block-reference-workflows" class="card">
        <div class="textWrapper">
          <h2>Actions Reference</h2>
          <p>Technical reference for executing actions in a monday workflow.</p>
        </div>
      </a>
      <a href="https://developer.monday.com/apps/docs/trigger-block-reference-workflows" class="card">
        <div class="textWrapper">
          <h2>Triggers Reference</h2>
          <p>Technical reference for invoking a workflow and handling subscriptions.</p>
        </div>
      </a>
      <a href="https://developer.monday.com/apps/docs/primitive-fields" class="card">
        <div class="textWrapper">
          <h2>Primitive Fields</h2>
          <p>Technical reference to create your own string, number, boolean, and date fields.</p>
        </div>
      </a>
    </div>
  </div>
  `}
</HTMLBlock>

<br />

***

# About monday workflows

[monday workflows](https://support.monday.com/hc/en-us/articles/11065311570066-Get-started-monday-workflows) is a powerful platform component that allows users to automate their processes. Through the visual workflow builder, users can combine blocks of triggers, actions, and conditions to assemble the perfect workflow.

The apps framework exposes two features to build custom blocks and fields:

* **Automation block**
* **Field for automation block**

<Image align="center" border={true} src="https://files.readme.io/015c217-monday_workflows.png" className="border" />

You can develop custom blocks with their own data handling using these app features. You can create both actions and trigger blocks that can be combined with any other blocks in the workflow builder to create flexible integration recipes. Each block is comprised of:

* Public endpoints for the monday apps server to send requests
* Input fields that specify what data your block needs to run
* Output fields that define what data your block sends to the next block

You'll also configure input and output fields for your blocks. You can select these fields from monday's built-in field types, or you can create custom fields using the **Field for automation block** app feature.

Combined, these app features open up a world of possibilities. They offer a flexible, highly customizable solution for building powerful and efficient integrations, ultimately helping to streamline business processes.

With the workflow builder, the sky is the limit!

<br />