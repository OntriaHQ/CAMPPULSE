import strawberry
from services.admin.graphql.queries import Query
from services.admin.graphql.mutations import Mutation

schema = strawberry.Schema(query=Query, mutation=Mutation)
