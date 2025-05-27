# Script: pull_wk.R
# Author: [Your Name/Contributor]
# Date:   [Current Date or Last Revision Date]
#
# Description:
# This script provides a set of functions to interact with a Supabase database,
# specifically for fetching and pushing workout data. It also includes
# functions to visualize workout data, such as workout phases over time and
# monthly summaries of climbing grades.
#
# Required Packages: httr, jsonlite, ggplot2, lubridate
#
# Ensure these packages are installed before running the script:
# install.packages(c("httr", "jsonlite", "ggplot2", "lubridate"))

# Load necessary libraries
library(httr)
library(jsonlite)
library(ggplot2)
library(lubridate)

# query_data Function
#
# Fetches data from the 'workouts' table in a Supabase project.
#
# Args:
#   supabase_url (character): The base URL of the Supabase project.
#                             Example: "https://your-project-id.supabase.co"
#   api_key (character):      The Supabase API key (anon or service_role key).
#
# Returns:
#   A data frame containing all columns from the 'workouts' table.
#   Returns NULL if an error occurs during the API request or JSON parsing.
#   Error messages are printed to the console in case of failure.
query_data <- function(supabase_url, api_key) {
  # Construct the request URL for the 'workouts' table
  request_url <- paste0(supabase_url, "/rest/v1/workouts?select=*")

  # Perform the GET request
  response <- tryCatch({
    GET(
      url = request_url,
      add_headers(
        "apikey" = api_key,
        "Authorization" = paste("Bearer", api_key) # Standard for Supabase
      )
    )
  }, error = function(e) {
    message("Error during API GET request: ", e$message)
    return(NULL)
  })

  # Check if the request itself failed (e.g., network issue)
  if (is.null(response)) {
    return(NULL)
  }

  # Check for non-successful HTTP status codes
  if (http_status(response)$category != "Success") {
    message("API request failed with status: ", http_status(response)$message)
    # Optionally, print response content for more detailed error diagnosis
    # message("Response content: ", content(response, "text", encoding = "UTF-8"))
    return(NULL)
  }

  # Parse the JSON response content
  data_content <- content(response, "text", encoding = "UTF-8")
  fetched_data <- tryCatch({
    fromJSON(data_content, flatten = TRUE) # flatten = TRUE is useful for nested JSON
  }, error = function(e) {
    message("Error parsing JSON response: ", e$message)
    return(NULL)
  })

  if (is.null(fetched_data)) {
    return(NULL)
  }
  
  # Return the data as a data frame
  return(as.data.frame(fetched_data))
}

# push_data Function
#
# Pushes data (inserts or updates) to the 'workouts' table in a Supabase project.
# Uses "Prefer: resolution=merge-duplicates" to update existing rows if a conflict
# occurs (based on primary key), otherwise inserts new rows.
#
# Args:
#   supabase_url (character): The base URL of the Supabase project.
#                             Example: "https://your-project-id.supabase.co"
#   api_key (character):      The Supabase API key (service_role key recommended for write operations).
#   data_to_push (data.frame): A data frame containing the data to be pushed.
#                              Column names in the data frame should match the
#                              column names in the Supabase 'workouts' table.
#
# Returns:
#   A character string message indicating the success or failure of the data push operation.
#   Includes details from the API if the request fails.
push_data <- function(supabase_url, api_key, data_to_push) {
  # Construct the request URL for the 'workouts' table
  request_url <- paste0(supabase_url, "/rest/v1/workouts")

  # Validate that data_to_push is a data frame
  if (!is.data.frame(data_to_push)) {
    return("Failed to push data: input 'data_to_push' must be a data frame.")
  }

  # Convert data frame to JSON format
  json_data <- tryCatch({
    toJSON(data_to_push, auto_unbox = TRUE) # auto_unbox = TRUE is important for Supabase
  }, error = function(e) {
    message("Error converting data to JSON: ", e$message)
    return(NULL)
  })

  if (is.null(json_data)) {
    return("Failed to push data: Could not convert data to JSON.")
  }

  # Perform the POST request
  response <- tryCatch({
    POST(
      url = request_url,
      add_headers(
        "apikey" = api_key,
        "Authorization" = paste("Bearer", api_key),
        "Content-Type" = "application/json",
        "Prefer" = "resolution=merge-duplicates" # Handles upsert behavior
      ),
      body = json_data
    )
  }, error = function(e) {
    message("Error during API POST request: ", e$message)
    return(NULL)
  })

  # Check if the request itself failed
  if (is.null(response)) {
    return("Failed to push data: API POST request error (e.g., network issue).")
  }

  # Check for non-successful HTTP status codes
  # Supabase often returns 200 or 201 for successful POST/PATCH with "Prefer" header
  if (status_code(response) >= 300) { # More general check for errors
    message_detail <- content(response, "text", encoding = "UTF-8")
    return(paste0("Failed to push data: API request failed with status code: ", status_code(response), 
                  ", Message: ", http_status(response)$message, ". Details: ", message_detail))
  }

  return("Data pushed successfully.")
}

# plot_workout_phases Function
#
# Creates a line plot visualizing workout phases over time.
#
# Args:
#   workout_data (data.frame): A data frame containing workout information.
#                              Must include a 'date' column (convertible to Date objects)
#                              and a 'phase' column (can be categorical or numerical).
#
# Returns:
#   A ggplot object representing the line plot of workout phases.
#   Returns NULL if input validation fails or an error occurs during plotting.
#   Error/warning messages are printed to the console.
plot_workout_phases <- function(workout_data) {
  # Validate input data
  if (!is.data.frame(workout_data) || !all(c("date", "phase") %in% names(workout_data))) {
    message("Error in plot_workout_phases: 'workout_data' must be a data frame with 'date' and 'phase' columns.")
    return(NULL)
  }

  # Convert 'date' column to Date objects, handling potential errors
  workout_data$date <- tryCatch({
    as.Date(workout_data$date)
  }, warning = function(w) {
    message("Warning in plot_workout_phases (converting 'date'): ", w$message)
    as.Date(workout_data$date) # Attempt conversion despite warning
  }, error = function(e) {
    message("Error in plot_workout_phases (converting 'date'): ", e$message)
    return(NULL) # Return NULL if date conversion fails critically
  })

  if (any(is.na(workout_data$date))) {
     message("Warning in plot_workout_phases: Some 'date' values resulted in NA after conversion. These points will be omitted.")
     workout_data <- workout_data[!is.na(workout_data$date), ]
  }
  if (is.null(workout_data$date) || nrow(workout_data) == 0) { # Check if conversion failed or no valid dates
      message("Error in plot_workout_phases: 'date' column could not be processed or resulted in no valid data.")
      return(NULL)
  }
  
  # Ensure 'phase' is treated as a factor for plotting if it's not numeric
  # This helps in creating distinct steps/points if phases are categorical (e.g., "Base", "Build")
  if (!is.numeric(workout_data$phase)) {
    workout_data$phase <- as.factor(workout_data$phase)
  }

  # Create the plot
  p <- ggplot(workout_data, aes(x = date, y = phase, group = 1)) + # group=1 for a single line
    geom_line(color = "dodgerblue") +
    geom_point(color = "dodgerblue", size = 2) + # Add points to highlight phase changes or data points
    labs(
      title = "Workout Phases Over Time",
      x = "Date",
      y = "Workout Phase"
    ) +
    theme_minimal(base_size = 14) + # Increase base font size for readability
    theme(axis.text.x = element_text(angle = 45, hjust = 1)) # Improve x-axis label readability

  return(p)
}

# plot_monthly_grade_summary Function
#
# Creates a bar plot summarizing average climbing grades per month.
#
# Args:
#   workout_data (data.frame): A data frame containing workout information.
#                              Must include a 'date' column (convertible to Date objects)
#                              and a 'grade' column.
#                              The 'grade' column is assumed to be numerical or
#                              convertible to numerical (e.g., "V0" will be parsed as 0
#                              if using a helper function to convert V-grades, or
#                              attempted as as.numeric).
#
# Returns:
#   A ggplot object representing the bar plot of average monthly grades.
#   Returns NULL if input validation fails or an error occurs during plotting.
#   Error/warning messages are printed to the console.
plot_monthly_grade_summary <- function(workout_data) {
  # Validate input data
  if (!is.data.frame(workout_data) || !all(c("date", "grade") %in% names(workout_data))) {
    message("Error in plot_monthly_grade_summary: 'workout_data' must be a data frame with 'date' and 'grade' columns.")
    return(NULL)
  }

  # Convert 'date' column to Date objects, handling potential errors
  workout_data$date <- tryCatch({
    as.Date(workout_data$date)
  }, warning = function(w) {
    message("Warning in plot_monthly_grade_summary (converting 'date'): ", w$message)
    as.Date(workout_data$date) # Attempt conversion despite warning
  }, error = function(e) {
    message("Error in plot_monthly_grade_summary (converting 'date'): ", e$message)
    return(NULL) # Return NULL if date conversion fails critically
  })

  if (any(is.na(workout_data$date))) {
     message("Warning in plot_monthly_grade_summary: Some 'date' values resulted in NA after conversion. These records will be omitted.")
     workout_data <- workout_data[!is.na(workout_data$date), ]
  }
   if (is.null(workout_data$date) || nrow(workout_data) == 0) { # Check if conversion failed or no valid dates
      message("Error in plot_monthly_grade_summary: 'date' column could not be processed or resulted in no valid data.")
      return(NULL)
  }

  # Handle 'grade' column: attempt conversion to numeric if not already.
  # This is a basic attempt; more sophisticated parsing (e.g., for "V-grades") might be needed.
  if (!is.numeric(workout_data$grade)) {
     message("Warning in plot_monthly_grade_summary: 'grade' column is not numeric. Attempting direct conversion to numeric. For V-grades (e.g., 'V5'), this might produce NAs or incorrect values if not simple numbers. Consider pre-processing 'grade' into a numerical scale.")
     original_grades <- workout_data$grade # Store original for context if needed
     workout_data$grade <- suppressWarnings(as.numeric(as.character(workout_data$grade))) # Convert factor to char then to numeric
     
     # Report on conversion success/failure
     na_after_conversion <- sum(is.na(workout_data$grade))
     # message(paste0("Number of NA grades after conversion: ", na_after_conversion, " out of ", length(original_grades)))
  }
  
  # Remove rows with NA grades that might have resulted from conversion or were originally NA
  workout_data <- workout_data[!is.na(workout_data$grade), ]
  if(nrow(workout_data) == 0) {
    message("Error in plot_monthly_grade_summary: No valid numeric grade data available after NA removal to plot.")
    return(NULL)
  }

  # Extract month and year for aggregation
  workout_data$month_year <- floor_date(workout_data$date, "month")

  # Calculate average grade per month using aggregate (base R)
  # For more complex aggregation, dplyr could be used (see commented example in original code)
  monthly_summary <- aggregate(grade ~ month_year, data = workout_data, FUN = mean, na.rm = TRUE)
  names(monthly_summary)[names(monthly_summary) == "grade"] <- "average_grade" # Rename for clarity

  if(nrow(monthly_summary) == 0) {
    message("Warning in plot_monthly_grade_summary: No data available for monthly summary after aggregation.")
    return(NULL)
  }

  # Create the bar plot
  p <- ggplot(monthly_summary, aes(x = month_year, y = average_grade)) +
    geom_bar(stat = "identity", fill = "steelblue") +
    scale_x_date(date_breaks = "1 month", date_labels = "%Y-%m") + # Format x-axis labels
    labs(
      title = "Monthly Average Climbing Grade",
      x = "Month",
      y = "Average Grade"
    ) +
    theme_minimal(base_size = 14) + # Increase base font size
    theme(axis.text.x = element_text(angle = 45, hjust = 1)) # Rotate x-axis labels for readability

  return(p)
}
