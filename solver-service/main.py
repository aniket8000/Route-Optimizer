from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

app = FastAPI(title="Route Optimizer - Solver Service")


class OptimizeRequest(BaseModel):
    # square matrix, duration_matrix[i][j] = seconds to go from stop i to stop j
    duration_matrix: list[list[float]]
    depot_index: int = 0  # which stop the driver starts/ends at


class OptimizeResponse(BaseModel):
    order: list[int]
    total_duration: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    n = len(req.duration_matrix)
    if n == 0:
        raise HTTPException(400, "duration_matrix can't be empty")
    if any(len(row) != n for row in req.duration_matrix):
        raise HTTPException(400, "duration_matrix has to be square (same rows and columns)")
    if not (0 <= req.depot_index < n):
        raise HTTPException(400, "depot_index out of range")

    order, total = solve_tsp(req.duration_matrix, req.depot_index)
    return OptimizeResponse(order=order, total_duration=total)


def solve_tsp(matrix: list[list[float]], depot: int) -> tuple[list[int], float]:
    n = len(matrix)

    # a real delivery driver doesn't drive back to the depot after the last drop -
    # so we bolt on a dummy "trip's over" node with zero cost from anywhere, and make
    # that the end of the route instead of forcing a loop back to the start
    dummy_end = n
    manager = pywrapcp.RoutingIndexManager(n + 1, 1, [depot], [dummy_end])
    routing = pywrapcp.RoutingModel(manager)

    # OR-Tools wants integer costs, matrix comes in as seconds (float) so scale it up
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        if from_node == dummy_end or to_node == dummy_end:
            return 0
        return int(matrix[from_node][to_node])

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    # PATH_CHEAPEST_ARC alone just takes the first greedy guess - throw guided local
    # search at it for a couple seconds so it actually looks for something better
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.FromSeconds(3)

    solution = routing.SolveWithParameters(search_params)
    if solution is None:
        raise HTTPException(500, "solver couldn't find a route for this matrix")

    order = []
    index = routing.Start(0)
    total_duration = 0
    while not routing.IsEnd(index):
        order.append(manager.IndexToNode(index))
        prev_index = index
        index = solution.Value(routing.NextVar(index))
        total_duration += routing.GetArcCostForVehicle(prev_index, index, 0)

    return order, total_duration
