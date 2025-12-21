class ResourceNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export default ResourceNotFoundError;
