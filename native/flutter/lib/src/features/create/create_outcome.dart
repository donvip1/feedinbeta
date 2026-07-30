sealed class CreateOutcome {
  const CreateOutcome();
}

class CreatePublished extends CreateOutcome {
  const CreatePublished(this.postId);

  final String postId;
}

class CreateDraftSaved extends CreateOutcome {
  const CreateDraftSaved();
}
