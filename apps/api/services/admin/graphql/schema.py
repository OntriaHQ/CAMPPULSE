import strawberry
from strawberry.schema.config import StrawberryConfig
from services.admin.graphql.queries import Query
from services.admin.graphql.mutations import Mutation

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    config=StrawberryConfig(auto_camel_case=False),
)
